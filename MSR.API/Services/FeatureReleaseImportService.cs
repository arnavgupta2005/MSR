using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using MSR.API.Data;
using MSR.API.DTOs.Admin;
using MSR.API.Models;

namespace MSR.API.Services
{
    public class FeatureReleaseImportService : IFeatureReleaseImportService
    {
        private readonly MSRDbContext _context;
        private readonly IExcelReaderService _excel;

        private const string ImportType = "Feature Release";

        private const int FeatureDescriptionMaxLength = 500;
        private const int DelayReasonMaxLength = 500;

        // Matches an optional leading "S"/"s" followed by a sprint number, e.g. "S10", "s 10", "10".
        private static readonly Regex SprintRegex =
            new(@"^(?:[sS]\s*)?0*(\d+)$", RegexOptions.Compiled);

        public FeatureReleaseImportService(
            MSRDbContext context,
            IExcelReaderService excel)
        {
            _context = context;
            _excel = excel;
        }

        // ---- Columns (canonical header -> display name) ----
        private const string ColFeatureDescription = "feature description";
        private const string ColPlannedSprint = "planned sprint";
        private const string ColReleasedSprint = "released sprint";
        private const string ColReasonOfDelay = "reason of delay";
        private const string ColProduct = "product";

        // The FeatureRelease table stores the product as a plain name string and the
        // Feature Release UI filters on exactly these values (see FEATURE_PRODUCTS in
        // the Angular report.config). They are the application's product contract.
        private static readonly Dictionary<string, string> AllowedProducts = new()
        {
            ["intrics"] = "Intrics",
            ["infoquest"] = "InfoQuest",
        };

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

            var seenKeys = new HashSet<(string, string, int)>();
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

            var seenKeys = new HashSet<(string, string, int)>();
            var toInsert = new List<FeatureRelease>();

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
                return result;
            }

            await using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Create any sprint numbers referenced by the file that do not yet
                // exist, so the new feature releases point at valid sprints.
                if (master.NewSprintNumbers.Count > 0)
                {
                    var newSprints = master.NewSprintNumbers
                        .Select(n => new Sprint { SprintNumber = n })
                        .ToList();
                    await _context.Sprints.AddRangeAsync(newSprints);
                }

                await _context.FeatureReleases.AddRangeAsync(toInsert);
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
            result.Message = $"Successfully imported {toInsert.Count} new record(s).";

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

            // Released Sprint and Reason of delay are optional (nullable in the DB),
            // so only these three headers are strictly required.
            var required = new List<(string Canonical, string Display)>
            {
                (ColFeatureDescription, "Feature Description"),
                (ColPlannedSprint, "Planned Sprint"),
                (ColProduct, "Product"),
            };

            var missing = required
                .Where(c => !present.Contains(c.Canonical))
                .Select(c => c.Display)
                .ToList();

            if (missing.Count > 0)
            {
                var list = string.Join(", ", missing);
                return new List<string>
                {
                    $"Invalid Feature Release Excel format. Missing required column(s): {list}."
                };
            }

            return new List<string>();
        }

        private async Task<MasterData> LoadMasterDataAsync()
        {
            var sprints = await _context.Sprints.AsNoTracking().ToListAsync();

            var existing = await _context.FeatureReleases
                .AsNoTracking()
                .Select(x => new { x.FeatureDescription, x.ProductName, x.PlannedSprint })
                .ToListAsync();

            return new MasterData
            {
                SprintNumbers = sprints.Select(s => s.SprintNumber).ToHashSet(),
                ExistingKeys = existing
                    .Where(x => x.PlannedSprint.HasValue)
                    .Select(x => (
                        _excel.Canonicalize(x.FeatureDescription),
                        _excel.Canonicalize(x.ProductName),
                        x.PlannedSprint!.Value))
                    .ToHashSet(),
            };
        }

        // ---- Per-row validation, resolution and duplicate detection ----
        private (ImportRowResultDto Result, FeatureRelease? Entity) EvaluateRow(
            ExcelRow row,
            MasterData master,
            HashSet<(string, string, int)> seenKeys)
        {
            var result = new ImportRowResultDto
            {
                RowNumber = row.RowNumber,
                FeatureDescription = row.Get(ColFeatureDescription),
                PlannedSprint = row.Get(ColPlannedSprint),
                ReleasedSprint = row.Get(ColReleasedSprint),
                Product = row.Get(ColProduct)
            };

            var entity = new FeatureRelease();

            // ---- Feature Description (required) ----
            string? featureDescription = null;
            if (TryValidateFeatureDescription(row.Get(ColFeatureDescription), result.Errors, out var description))
            {
                featureDescription = description;
                entity.FeatureDescription = description;
            }

            // ---- Product (required, must be an allowed Feature Release product) ----
            string? productName = null;
            if (TryValidateProduct(row.Get(ColProduct), result.Errors, out var product))
            {
                productName = product;
                entity.ProductName = product;
            }

            // ---- Planned Sprint (required) ----
            var plannedSprint = ResolveSprint(
                row.Get(ColPlannedSprint), "Planned Sprint", required: true, master, result.Errors);
            if (plannedSprint.HasValue)
            {
                entity.PlannedSprint = plannedSprint.Value;
            }

            // ---- Released Sprint (optional) ----
            var releasedSprint = ResolveSprint(
                row.Get(ColReleasedSprint), "Released Sprint", required: false, master, result.Errors);
            entity.ReleasedSprint = releasedSprint;

            // ---- Reason of delay (optional; may become required by business rule below) ----
            var delayReason = NormalizeDelayReason(row.Get(ColReasonOfDelay), result.Errors);
            entity.DelayReason = delayReason;

            // ---- Cross-field business rules for the two sprints ----
            if (plannedSprint.HasValue && releasedSprint.HasValue)
            {
                if (releasedSprint.Value < plannedSprint.Value)
                {
                    result.Errors.Add("Released Sprint cannot be earlier than Planned Sprint.");
                }
            }

            if (result.Errors.Count > 0)
            {
                result.Status = ImportRowStatus.Invalid;
                return (result, null);
            }

            var key = (
                _excel.Canonicalize(featureDescription),
                _excel.Canonicalize(productName),
                plannedSprint!.Value);

            // Duplicate against the database or an earlier row in the same file.
            if (master.ExistingKeys.Contains(key) || !seenKeys.Add(key))
            {
                result.Status = ImportRowStatus.Duplicate;
                result.Errors.Add(
                    $"Duplicate feature already exists for '{featureDescription}', " +
                    $"Planned Sprint {plannedSprint.Value}, Product {productName}.");
                return (result, null);
            }

            result.Status = ImportRowStatus.New;
            return (result, entity);
        }

        // Resolve an Excel sprint value ("S10"/"10") to a sprint number that exists
        // in the Sprint master table. Returns null when empty/invalid.
        private int? ResolveSprint(
            string? value,
            string fieldName,
            bool required,
            MasterData master,
            List<string> errors)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                if (required)
                {
                    errors.Add($"{fieldName} cannot be empty.");
                }
                return null;
            }

            var match = SprintRegex.Match(value.Trim());
            if (!match.Success
                || !int.TryParse(match.Groups[1].Value, out var number)
                || number <= 0)
            {
                errors.Add($"Invalid {fieldName} '{value}'.");
                return null;
            }

            if (!master.SprintNumbers.Contains(number))
            {
                // Unknown sprint number: register it so it is created during import
                // (mirrors the auto-create behaviour of the other importers).
                master.NewSprintNumbers.Add(number);
            }

            return number;
        }

        private static bool TryValidateFeatureDescription(string? value, List<string> errors, out string result)
        {
            result = string.Empty;
            if (string.IsNullOrWhiteSpace(value))
            {
                errors.Add("Feature Description cannot be empty.");
                return false;
            }

            var trimmed = value.Trim();
            if (trimmed.Length > FeatureDescriptionMaxLength)
            {
                errors.Add($"Feature Description must be {FeatureDescriptionMaxLength} characters or fewer.");
                return false;
            }

            result = trimmed;
            return true;
        }

        private static bool TryValidateProduct(string? value, List<string> errors, out string result)
        {
            result = string.Empty;
            if (string.IsNullOrWhiteSpace(value))
            {
                errors.Add("Product cannot be empty.");
                return false;
            }

            var canonical = value.Trim().ToLowerInvariant();
            if (!AllowedProducts.TryGetValue(canonical, out var displayName))
            {
                errors.Add(
                    $"Product '{value.Trim()}' is not a valid Feature Release product. " +
                    "Allowed values: Intrics, InfoQuest.");
                return false;
            }

            result = displayName;
            return true;
        }

        private static string? NormalizeDelayReason(string? value, List<string> errors)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            var trimmed = value.Trim();
            if (trimmed.Length > DelayReasonMaxLength)
            {
                errors.Add($"Reason of delay must be {DelayReasonMaxLength} characters or fewer.");
                return null;
            }

            return trimmed;
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
            public HashSet<int> SprintNumbers { get; init; } = new();
            public HashSet<int> NewSprintNumbers { get; init; } = new();
            public HashSet<(string, string, int)> ExistingKeys { get; init; } = new();

            public static MasterData Empty => new();
        }
    }
}
