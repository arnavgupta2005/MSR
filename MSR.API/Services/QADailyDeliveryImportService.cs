using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using MSR.API.Data;
using MSR.API.DTOs.Admin;
using MSR.API.Models;

namespace MSR.API.Services
{
    public class QADailyDeliveryImportService : IQADailyDeliveryImportService
    {
        private readonly MSRDbContext _context;
        private readonly IExcelReaderService _excel;

        private const string ImportType = "QA Daily Delivery";

        // Accepts "Day 01", "Day 1", "01", "1" -> integer day number.
        private static readonly Regex DayRegex =
            new(@"^(?:day\s*)?0*(\d+)$", RegexOptions.Compiled | RegexOptions.IgnoreCase);

        public QADailyDeliveryImportService(
            MSRDbContext context,
            IExcelReaderService excel)
        {
            _context = context;
            _excel = excel;
        }

        // ---- Columns (canonical header -> display name) ----
        private const string ColSprint = "sprint";
        private const string ColDays = "days";
        private const string ColDelivery = "delivery";
        private const string ColProduct = "product";

        // InfoQuest QA has an extra Web/Mobile column and its Web + Mobile
        // deliveries are aggregated into a single record per Sprint + Day.
        // Canonicalized product name used to detect this special case.
        private const string InfoQuestQaProduct = "infoquest qa";

        public async Task<ImportPreviewDto> ValidateAsync(Stream stream, string fileName)
        {
            var preview = new ImportPreviewDto
            {
                FileName = fileName,
                ImportType = ImportType
            };

            var (readResult, columnErrors, master) = await ReadAndPrepareAsync(stream, fileName);
            if (columnErrors.Count > 0 || !readResult.IsValid)
            {
                preview.FileErrors = columnErrors;
                if (!readResult.IsValid && readResult.Error is not null)
                {
                    preview.FileErrors.Insert(0, readResult.Error);
                }
                return preview;
            }

            var seenKeys = new HashSet<(string, int, int)>();
            foreach (var row in readResult.Rows)
            {
                var evaluated = EvaluateRow(row, master, seenKeys);
                preview.Rows.Add(evaluated.Result);
            }

            ApplyCounts(preview);
            return preview;
        }

        public async Task<ImportResultDto> ImportAsync(Stream stream, string fileName, string? uploadedBy)
        {
            var result = new ImportResultDto
            {
                FileName = fileName
            };

            var (readResult, columnErrors, master) = await ReadAndPrepareAsync(stream, fileName);
            if (columnErrors.Count > 0 || !readResult.IsValid)
            {
                result.Success = false;
                result.FileErrors = columnErrors;
                if (!readResult.IsValid && readResult.Error is not null)
                {
                    result.FileErrors.Insert(0, readResult.Error);
                }
                result.Message = "The file was rejected. No records were imported.";
                return result;
            }

            var seenKeys = new HashSet<(string, int, int)>();
            var toInsert = new List<QADailyDelivery>();

            foreach (var row in readResult.Rows)
            {
                var evaluated = EvaluateRow(row, master, seenKeys);
                result.Rows.Add(evaluated.Result);

                if (evaluated.Result.Status == ImportRowStatus.New && evaluated.Entity is not null)
                {
                    toInsert.Add(evaluated.Entity);
                }
            }

            ApplyCounts(result);

            // Do not partially import: if any row is invalid, import nothing.
            if (result.InvalidRows > 0)
            {
                result.Success = false;
                result.Message =
                    $"Import cancelled. {result.InvalidRows} invalid row(s) must be fixed before importing.";
                return result;
            }

            if (toInsert.Count == 0)
            {
                result.Success = true;
                result.Message = "No new records to import. All rows already exist.";
                // Import history recording deferred - to be implemented later.
                return result;
            }

            await using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                await _context.QADailyDeliveries.AddRangeAsync(toInsert);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch (Exception)
            {
                await transaction.RollbackAsync();
                result.Success = false;
                result.Message = "A database error occurred while importing. No records were saved.";
                // Import history recording deferred - to be implemented later.
                return result;
            }

            result.Success = true;
            result.InsertedRows = toInsert.Count;
            result.Message = $"Successfully imported {toInsert.Count} new record(s).";

            // Import history recording deferred - to be implemented later.
            return result;
        }

        // ---- Shared setup: read file, validate columns, load master data ----
        private async Task<(ExcelReadResult Read, List<string> ColumnErrors, MasterData Master)>
            ReadAndPrepareAsync(Stream stream, string fileName)
        {
            var read = _excel.Read(stream, fileName);
            if (!read.IsValid)
            {
                return (read, new List<string>(), MasterData.Empty);
            }

            var columnErrors = ValidateColumns(read);
            if (columnErrors.Count > 0)
            {
                return (read, columnErrors, MasterData.Empty);
            }

            var master = await LoadMasterDataAsync();

            // InfoQuest QA delivers Web and Mobile rows separately; collapse them
            // into one aggregated row per Sprint + Day before validation/import.
            AggregateInfoQuestRows(read);

            return (read, columnErrors, master);
        }

        // ---- Merge InfoQuest QA Web/Mobile rows into a single delivery per Sprint + Day ----
        // For InfoQuest QA the source file contains separate Web and Mobile rows.
        // These must be combined (Delivery = Web + Mobile) into one record per
        // Sprint + Day. All other products (e.g. Intrics) are left untouched.
        private void AggregateInfoQuestRows(ExcelReadResult read)
        {
            var hasInfoQuest = read.Rows.Any(r =>
                _excel.Canonicalize(r.Get(ColProduct)) == InfoQuestQaProduct);

            if (!hasInfoQuest)
            {
                return;
            }

            var aggregated = new List<ExcelRow>();
            // Key: canonical Sprint + Day -> the row that accumulates the delivery total.
            var infoQuestGroups = new Dictionary<(string Sprint, string Day), ExcelRow>();

            foreach (var row in read.Rows)
            {
                if (_excel.Canonicalize(row.Get(ColProduct)) != InfoQuestQaProduct)
                {
                    aggregated.Add(row);
                    continue;
                }

                var sprint = row.Get(ColSprint)?.Trim() ?? string.Empty;
                var day = row.Get(ColDays)?.Trim() ?? string.Empty;
                var key = (_excel.Canonicalize(sprint), _excel.Canonicalize(day));

                if (!infoQuestGroups.TryGetValue(key, out var existing))
                {
                    infoQuestGroups[key] = row;
                    aggregated.Add(row);
                    continue;
                }

                // Combine this row's delivery into the previously kept row.
                existing.Cells[ColDelivery] =
                    SumDelivery(existing.Get(ColDelivery), row.Get(ColDelivery));
            }

            read.Rows = aggregated;
        }

        // Adds two delivery cell values. If either value is not a valid whole
        // number the original text is preserved so row validation still reports it.
        private static string? SumDelivery(string? first, string? second)
        {
            var firstValid = TryParseDelivery(first, out var a);
            var secondValid = TryParseDelivery(second, out var b);

            if (firstValid && secondValid)
            {
                return (a + b).ToString(CultureInfo.InvariantCulture);
            }

            // Keep a non-null invalid value so downstream validation surfaces the error.
            return firstValid ? second : first;
        }

        private static bool TryParseDelivery(string? value, out int result)
        {
            result = 0;
            if (string.IsNullOrWhiteSpace(value))
            {
                return false;
            }

            if (!decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var number)
                || number != Math.Truncate(number))
            {
                return false;
            }

            result = (int)number;
            return true;
        }

        private List<string> ValidateColumns(ExcelReadResult read)
        {
            var present = read.Headers
                .Select(_excel.Canonicalize)
                .Where(h => !string.IsNullOrEmpty(h))
                .ToHashSet();

            var expected = new List<(string Canonical, string Display)>
            {
                (ColSprint, "Sprint"),
                (ColDays, "Days"),
                (ColDelivery, "Delivery"),
                (ColProduct, "Product"),
            };

            var missing = expected
                .Where(c => !present.Contains(c.Canonical))
                .Select(c => c.Display)
                .ToList();

            if (missing.Count > 0)
            {
                var list = string.Join(", ", missing);
                return new List<string>
                {
                    $"Invalid QA Daily Delivery Excel. Missing columns: {list}."
                };
            }

            return new List<string>();
        }

        private async Task<MasterData> LoadMasterDataAsync()
        {
            var sprints = await _context.Sprints.AsNoTracking().ToListAsync();
            var products = await _context.ProductAreas.AsNoTracking().ToListAsync();

            var existingKeys = await _context.QADailyDeliveries
                .AsNoTracking()
                .Select(x => new { x.SprintId, x.ProductAreaId, x.Day })
                .ToListAsync();

            return new MasterData
            {
                SprintByNumber = sprints
                    .GroupBy(s => s.SprintNumber)
                    .ToDictionary(g => g.Key, g => g.First()),
                ProductByName = products
                    .GroupBy(p => _excel.Canonicalize(p.ProductAreaName))
                    .ToDictionary(g => g.Key, g => g.First()),
                ExistingKeys = existingKeys
                    .Select(k => (k.SprintId, k.ProductAreaId, k.Day))
                    .ToHashSet(),
            };
        }

        // ---- Per-row validation, FK resolution and duplicate detection ----
        private (ImportRowResultDto Result, QADailyDelivery? Entity) EvaluateRow(
            ExcelRow row,
            MasterData master,
            HashSet<(string, int, int)> seenKeys)
        {
            var result = new ImportRowResultDto
            {
                RowNumber = row.RowNumber,
                Sprint = row.Get(ColSprint),
                Day = row.Get(ColDays),
                Delivery = row.Get(ColDelivery),
                Product = row.Get(ColProduct)
            };

            var entity = new QADailyDelivery();

            var day = ResolveDay(row.Get(ColDays), result.Errors);
            if (day.HasValue)
            {
                entity.Day = day.Value;
            }

            if (TryValidateInt(row.Get(ColDelivery), "Delivery", result.Errors, out var delivery))
            {
                entity.Delivery = delivery;
            }

            // ---- Foreign keys ----
            var sprint = ResolveSprint(row.Get(ColSprint), master, result.Errors);
            var product = ResolveProduct(row.Get(ColProduct), master, result.Errors);

            if (result.Errors.Count > 0)
            {
                result.Status = ImportRowStatus.Invalid;
                return (result, null);
            }

            entity.ProductAreaId = product!.ProductAreaId;

            // Existing sprints are referenced by id; unknown ones are created during
            // import by attaching the new (untracked) entity.
            string sprintKey;
            if (sprint!.SprintId != 0)
            {
                entity.SprintId = sprint.SprintId;
                sprintKey = sprint.SprintId.ToString(CultureInfo.InvariantCulture);
            }
            else
            {
                entity.Sprint = sprint;
                sprintKey = "new:" + sprint.SprintNumber.ToString(CultureInfo.InvariantCulture);
            }

            var key = (sprintKey, entity.ProductAreaId, entity.Day);

            // Duplicate against the database (only when the sprint already exists) or
            // an earlier row in the same file.
            var isDbDuplicate = sprint.SprintId != 0
                && master.ExistingKeys.Contains((sprint.SprintId, entity.ProductAreaId, entity.Day));
            if (isDbDuplicate || !seenKeys.Add(key))
            {
                result.Status = ImportRowStatus.Duplicate;
                result.Errors.Add(
                    $"Duplicate record already exists for Sprint {result.Sprint}, " +
                    $"Day {result.Day}, Product {result.Product}.");
                return (result, null);
            }

            result.Status = ImportRowStatus.New;
            return (result, entity);
        }

        private static int? ResolveDay(string? value, List<string> errors)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                errors.Add("Days cannot be empty.");
                return null;
            }

            var match = DayRegex.Match(value.Trim());
            if (!match.Success)
            {
                errors.Add($"Invalid Day value '{value}'.");
                return null;
            }

            if (!int.TryParse(match.Groups[1].Value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var day)
                || day <= 0)
            {
                errors.Add($"Invalid Day value '{value}'.");
                return null;
            }

            return day;
        }

        private Sprint? ResolveSprint(string? value, MasterData master, List<string> errors)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                errors.Add("Sprint cannot be empty.");
                return null;
            }

            if (!int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var number))
            {
                errors.Add("Sprint must be a valid number.");
                return null;
            }

            if (master.SprintByNumber.TryGetValue(number, out var sprint))
            {
                return sprint;
            }

            // Unknown sprint: create a new one (reused across rows in this file).
            if (!master.NewSprintsByNumber.TryGetValue(number, out var created))
            {
                created = new Sprint { SprintNumber = number };
                master.NewSprintsByNumber[number] = created;
            }

            return created;
        }

        private ProductArea? ResolveProduct(string? value, MasterData master, List<string> errors)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                errors.Add("Product cannot be empty.");
                return null;
            }

            if (!master.ProductByName.TryGetValue(_excel.Canonicalize(value), out var product))
            {
                errors.Add($"Product '{value}' does not exist in ProductArea.");
                return null;
            }

            return product;
        }

        private static bool TryValidateInt(string? value, string display, List<string> errors, out int result)
        {
            result = 0;
            if (string.IsNullOrWhiteSpace(value))
            {
                errors.Add($"{display} cannot be empty.");
                return false;
            }

            if (!decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var number)
                || number != Math.Truncate(number))
            {
                errors.Add($"{display} must be a valid whole number.");
                return false;
            }

            if (number < 0)
            {
                errors.Add($"{display} cannot be negative.");
                return false;
            }

            result = (int)number;
            return true;
        }

        private static void ApplyCounts(ImportPreviewDto preview)
        {
            preview.TotalRows = preview.Rows.Count;
            preview.NewRows = preview.Rows.Count(r => r.Status == ImportRowStatus.New);
            preview.DuplicateRows = preview.Rows.Count(r => r.Status == ImportRowStatus.Duplicate);
            preview.InvalidRows = preview.Rows.Count(r => r.Status == ImportRowStatus.Invalid);
        }

        private static void ApplyCounts(ImportResultDto result)
        {
            result.TotalRows = result.Rows.Count;
            result.DuplicateRows = result.Rows.Count(r => r.Status == ImportRowStatus.Duplicate);
            result.InvalidRows = result.Rows.Count(r => r.Status == ImportRowStatus.Invalid);
        }

        private sealed class MasterData
        {
            public Dictionary<int, Sprint> SprintByNumber { get; init; } = new();
            public Dictionary<string, ProductArea> ProductByName { get; init; } = new();
            public Dictionary<int, Sprint> NewSprintsByNumber { get; init; } = new();
            public HashSet<(int, int, int)> ExistingKeys { get; init; } = new();

            public static MasterData Empty => new();
        }
    }
}
