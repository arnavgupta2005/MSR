using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using MSR.API.Data;
using MSR.API.DTOs.Admin;
using MSR.API.Models;

namespace MSR.API.Services
{
    public class IterationImportService : IIterationImportService
    {
        private readonly MSRDbContext _context;
        private readonly IExcelReaderService _excel;

        private const string ImportType = "Iteration";

        private const string ColSprint = "sprint";
        private const string ColIteration0 = "iteration 0";
        private const string ColIteration1 = "iteration 1";
        private const string ColIteration2 = "iteration 2";
        private const string ColOthers = "others";
        private const string ColProduct = "product";
        private static readonly Regex SprintNumberRegex =
            new(@"^\s*(?:sprint\s*)?(\d+)\s*$", RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private static readonly (string Canonical, string Display, Action<Iteration, int?> Set)[] PercentageColumns =
        {
            (ColIteration0, "Iteration 0", (e, v) => e.Iteration0 = v),
            (ColIteration1, "Iteration 1", (e, v) => e.Iteration1 = v),
            (ColIteration2, "Iteration 2", (e, v) => e.Iteration2 = v),
            (ColOthers, "Others", (e, v) => e.Others = v),
        };

        public IterationImportService(
            MSRDbContext context,
            IExcelReaderService excel)
        {
            _context = context;
            _excel = excel;
        }

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

            var seenKeys = new HashSet<(string, int)>();
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

            var seenKeys = new HashSet<(string, int)>();
            var toInsert = new List<Iteration>();

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

            if (toInsert.Count == 0)
            {
                result.Success = true;
                result.Message = result.InvalidRows > 0
                    ? $"No new records were imported. {result.InvalidRows} invalid row(s) were skipped."
                    : "No new records to import. All rows already exist.";
                return result;
            }

            await using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                await _context.Iterations.AddRangeAsync(toInsert);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch (Exception)
            {
                await transaction.RollbackAsync();
                result.Success = false;
                result.Message = "A database error occurred while importing. No records were saved.";
                return result;
            }

            result.Success = true;
            result.InsertedRows = toInsert.Count;
            result.Message = result.InvalidRows > 0
                ? $"Successfully imported {toInsert.Count} new record(s). {result.InvalidRows} invalid row(s) were skipped."
                : $"Successfully imported {toInsert.Count} new record(s).";

            return result;
        }

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
            return (read, columnErrors, master);
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
                (ColProduct, "Product"),
            };
            expected.AddRange(PercentageColumns.Select(c => (c.Canonical, c.Display)));

            var missing = expected
                .Where(c => !present.Contains(c.Canonical))
                .Select(c => c.Display)
                .ToList();

            if (missing.Count > 0)
            {
                var list = string.Join(", ", missing);
                return new List<string>
                {
                    $"Invalid Iteration Excel. Missing columns: {list}."
                };
            }

            return new List<string>();
        }

        private async Task<MasterData> LoadMasterDataAsync()
        {
            var sprints = await _context.Sprints.AsNoTracking().ToListAsync();
            var products = await _context.ProductAreas.AsNoTracking().ToListAsync();

            var existingKeys = await _context.Iterations
                .AsNoTracking()
                .Select(x => new { x.SprintId, x.ProductAreaId })
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
                    .Select(k => (k.SprintId, k.ProductAreaId))
                    .ToHashSet(),
            };
        }

        private (ImportRowResultDto Result, Iteration? Entity) EvaluateRow(
            ExcelRow row,
            MasterData master,
            HashSet<(string, int)> seenKeys)
        {
            var result = new ImportRowResultDto
            {
                RowNumber = row.RowNumber,
                Sprint = row.Get(ColSprint),
                Iteration0 = row.Get(ColIteration0),
                Iteration1 = row.Get(ColIteration1),
                Iteration2 = row.Get(ColIteration2),
                Others = row.Get(ColOthers),
                Product = row.Get(ColProduct)
            };

            var entity = new Iteration();

            foreach (var col in PercentageColumns)
            {
                var rawValue = row.Get(col.Canonical);
                if (TryValidatePercentageToInt(rawValue, col.Display, result.Errors, out var percent))
                {
                    col.Set(entity, percent);
                    SetPreviewPercentage(result, col.Canonical, percent, rawValue);
                }
            }

            var sprint = ResolveSprint(row.Get(ColSprint), master, result.Errors);
            var product = ResolveProduct(row.Get(ColProduct), master, result.Errors);

            if (result.Errors.Count > 0)
            {
                result.Status = ImportRowStatus.Invalid;
                return (result, null);
            }

            entity.ProductAreaId = product!.ProductAreaId;

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

            var key = (sprintKey, entity.ProductAreaId);

            var isDbDuplicate = sprint.SprintId != 0
                && master.ExistingKeys.Contains((sprint.SprintId, entity.ProductAreaId));
            if (isDbDuplicate || !seenKeys.Add(key))
            {
                result.Status = ImportRowStatus.Duplicate;
                result.Errors.Add(
                    $"Duplicate record already exists for Sprint {result.Sprint}, Product {result.Product}.");
                return (result, null);
            }

            result.Status = ImportRowStatus.New;
            return (result, entity);
        }

        private Sprint? ResolveSprint(string? value, MasterData master, List<string> errors)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                errors.Add("Sprint cannot be empty.");
                return null;
            }

            if (!TryParseSprintNumber(value, out var number))
            {
                errors.Add("Sprint must be a valid number.");
                return null;
            }

            if (master.SprintByNumber.TryGetValue(number, out var sprint))
            {
                return sprint;
            }

            if (!master.NewSprintsByNumber.TryGetValue(number, out var created))
            {
                created = new Sprint { SprintNumber = number };
                master.NewSprintsByNumber[number] = created;
            }

            return created;
        }

        private static bool TryParseSprintNumber(string value, out int number)
        {
            number = 0;
            var match = SprintNumberRegex.Match(value);
            if (!match.Success)
            {
                return false;
            }

            return int.TryParse(
                match.Groups[1].Value,
                NumberStyles.Integer,
                CultureInfo.InvariantCulture,
                out number);
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

        private static bool TryValidatePercentageToInt(
            string? value,
            string display,
            List<string> errors,
            out int? result)
        {
            result = null;

            if (string.IsNullOrWhiteSpace(value))
            {
                return true;
            }

            var text = value.Trim();
            var hasPercent = text.EndsWith("%", StringComparison.Ordinal);
            if (hasPercent)
            {
                text = text[..^1].Trim();
            }

            if (!decimal.TryParse(text, NumberStyles.Number, CultureInfo.InvariantCulture, out var number))
            {
                errors.Add($"{display} must be a valid percentage.");
                return false;
            }

            decimal normalized;
            if (hasPercent)
            {
                normalized = number;
            }
            else
            {
                normalized = number <= 1m ? number * 100m : number;
            }

            if (normalized < 0m || normalized > 100m)
            {
                errors.Add($"{display} must be between 0% and 100%.");
                return false;
            }

            result = (int)Math.Round(normalized, MidpointRounding.AwayFromZero);
            return true;
        }

        private static void SetPreviewPercentage(
            ImportRowResultDto result,
            string canonicalColumn,
            int? percentValue,
            string? rawValue)
        {
            var displayValue = percentValue?.ToString(CultureInfo.InvariantCulture) ?? rawValue;

            switch (canonicalColumn)
            {
                case ColIteration0:
                    result.Iteration0 = displayValue;
                    break;
                case ColIteration1:
                    result.Iteration1 = displayValue;
                    break;
                case ColIteration2:
                    result.Iteration2 = displayValue;
                    break;
                case ColOthers:
                    result.Others = displayValue;
                    break;
            }
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
            public HashSet<(int, int)> ExistingKeys { get; init; } = new();

            public static MasterData Empty => new();
        }
    }
}
