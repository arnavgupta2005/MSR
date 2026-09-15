using System.Globalization;
using Microsoft.EntityFrameworkCore;
using MSR.API.Data;
using MSR.API.DTOs.Admin;
using MSR.API.Models;

namespace MSR.API.Services
{
    public class QAUserStoryImportService : IQAUserStoryImportService
    {
        private readonly MSRDbContext _context;
        private readonly IExcelReaderService _excel;
        private readonly IImportHistoryService _history;

        private const string ImportType = "QA User Story";

        private const int WorkItemTypeMaxLength = 50;

        public QAUserStoryImportService(
            MSRDbContext context,
            IExcelReaderService excel,
            IImportHistoryService history)
        {
            _context = context;
            _excel = excel;
            _history = history;
        }

        // ---- Columns (canonical header -> display name) ----
        private const string ColSprint = "sprint";
        private const string ColId = "id";
        private const string ColWorkItemType = "work item type";
        private const string ColProduct = "product";

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

            var seenKeys = new HashSet<(int, int, int)>();
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

            var seenKeys = new HashSet<(int, int, int)>();
            var toInsert = new List<QAUserStory>();

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
                await _context.QAUserStories.AddRangeAsync(toInsert);
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
                (ColId, "ID"),
                (ColWorkItemType, "Work Item Type"),
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
                    $"Invalid QA User Story Excel. Missing columns: {list}."
                };
            }

            return new List<string>();
        }

        private async Task<MasterData> LoadMasterDataAsync()
        {
            var sprints = await _context.Sprints.AsNoTracking().ToListAsync();
            var products = await _context.ProductAreas.AsNoTracking().ToListAsync();

            var existingKeys = await _context.QAUserStories
                .AsNoTracking()
                .Select(x => new { x.SprintId, x.ProductAreaId, x.WorkItemId })
                .ToListAsync();

            return new MasterData
            {
                SprintByNumber = sprints
                    .GroupBy(s => s.SprintNumber)
                    .ToDictionary(g => g.Key, g => g.First().SprintId),
                ProductByName = products
                    .GroupBy(p => _excel.Canonicalize(p.ProductAreaName))
                    .ToDictionary(g => g.Key, g => g.First()),
                ExistingKeys = existingKeys
                    .Select(k => (k.SprintId, k.ProductAreaId, k.WorkItemId))
                    .ToHashSet(),
            };
        }

        // ---- Per-row validation, FK resolution and duplicate detection ----
        private (ImportRowResultDto Result, QAUserStory? Entity) EvaluateRow(
            ExcelRow row,
            MasterData master,
            HashSet<(int, int, int)> seenKeys)
        {
            var result = new ImportRowResultDto
            {
                RowNumber = row.RowNumber,
                Sprint = row.Get(ColSprint),
                WorkItemId = row.Get(ColId),
                WorkItemType = row.Get(ColWorkItemType),
                Product = row.Get(ColProduct)
            };

            var entity = new QAUserStory();

            if (TryValidateWorkItemId(row.Get(ColId), result.Errors, out var workItemId))
            {
                entity.WorkItemId = workItemId;
            }

            if (TryValidateWorkItemType(row.Get(ColWorkItemType), result.Errors, out var workItemType))
            {
                entity.WorkItemType = workItemType;
            }

            // ---- Foreign keys ----
            var sprintId = ResolveSprint(row.Get(ColSprint), master, result.Errors);
            var product = ResolveProduct(row.Get(ColProduct), master, result.Errors);

            if (result.Errors.Count > 0)
            {
                result.Status = ImportRowStatus.Invalid;
                return (result, null);
            }

            entity.SprintId = sprintId!.Value;
            entity.ProductAreaId = product!.ProductAreaId;

            var key = (entity.SprintId, entity.ProductAreaId, entity.WorkItemId);

            // Duplicate against the database or an earlier row in the same file.
            if (master.ExistingKeys.Contains(key) || !seenKeys.Add(key))
            {
                result.Status = ImportRowStatus.Duplicate;
                result.Errors.Add(
                    $"Duplicate record already exists for Sprint {result.Sprint}, " +
                    $"Work Item {result.WorkItemId}, Product {result.Product}.");
                return (result, null);
            }

            result.Status = ImportRowStatus.New;
            return (result, entity);
        }

        private int? ResolveSprint(string? value, MasterData master, List<string> errors)
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

            if (!master.SprintByNumber.TryGetValue(number, out var sprintId))
            {
                errors.Add($"Sprint {number} does not exist in the database.");
                return null;
            }

            return sprintId;
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

        private static bool TryValidateWorkItemId(string? value, List<string> errors, out int result)
        {
            result = 0;
            if (string.IsNullOrWhiteSpace(value))
            {
                errors.Add("ID cannot be empty.");
                return false;
            }

            if (!int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var number)
                || number <= 0)
            {
                errors.Add($"Invalid Work Item ID '{value}'.");
                return false;
            }

            result = number;
            return true;
        }

        private static bool TryValidateWorkItemType(string? value, List<string> errors, out string result)
        {
            result = string.Empty;
            if (string.IsNullOrWhiteSpace(value))
            {
                errors.Add("Work Item Type cannot be empty.");
                return false;
            }

            var trimmed = value.Trim();
            if (trimmed.Length > WorkItemTypeMaxLength)
            {
                errors.Add($"Work Item Type must be {WorkItemTypeMaxLength} characters or fewer.");
                return false;
            }

            result = trimmed;
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
            public Dictionary<int, int> SprintByNumber { get; init; } = new();
            public Dictionary<string, ProductArea> ProductByName { get; init; } = new();
            public HashSet<(int, int, int)> ExistingKeys { get; init; } = new();

            public static MasterData Empty => new();
        }
    }
}
