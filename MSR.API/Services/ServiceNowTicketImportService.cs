using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using MSR.API.Data;
using MSR.API.DTOs.Admin;
using MSR.API.Models;

namespace MSR.API.Services
{
    public class ServiceNowTicketImportService : IServiceNowTicketImportService
    {
        private readonly MSRDbContext _context;
        private readonly IExcelReaderService _excel;

        private const string ImportType = "ServiceNow Tickets";

        // Matches an optional leading "S"/"s" followed by a sprint number, e.g. "S10", "s 10", "10".
        private static readonly Regex SprintRegex =
            new(@"^(?:[sS]\s*)?0*(\d+)$", RegexOptions.Compiled);

        public ServiceNowTicketImportService(
            MSRDbContext context,
            IExcelReaderService excel)
        {
            _context = context;
            _excel = excel;
        }

        // ---- Columns (canonical header -> display name) ----
        private const string ColSprint = "sprint";
        private const string ColCriticalWeb = "criticalweb";
        private const string ColWeb = "web";
        private const string ColCriticalMobile = "criticalmobile";
        private const string ColMobile = "mobile";
        private const string ColCompletionPercentage = "completionpercentage";

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

            var seenSprints = new HashSet<int>();
            foreach (var row in readResult.Rows)
            {
                var evaluated = EvaluateRow(row, master, seenSprints);
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

            var seenSprints = new HashSet<int>();
            var toInsert = new List<ServiceNowTicket>();

            foreach (var row in readResult.Rows)
            {
                var evaluated = EvaluateRow(row, master, seenSprints);
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
                await _context.ServiceNowTickets.AddRangeAsync(toInsert);
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

            var required = new List<(string Canonical, string Display)>
            {
                (ColSprint, "Sprint"),
                (ColCriticalWeb, "CriticalWeb"),
                (ColWeb, "Web"),
                (ColCriticalMobile, "CriticalMobile"),
                (ColMobile, "Mobile"),
                (ColCompletionPercentage, "CompletionPercentage"),
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
                    $"Invalid ServiceNow Tickets Excel format. Missing required column(s): {list}."
                };
            }

            return new List<string>();
        }

        private async Task<MasterData> LoadMasterDataAsync()
        {
            var existingSprints = await _context.ServiceNowTickets
                .AsNoTracking()
                .Select(x => x.Sprint)
                .ToListAsync();

            return new MasterData
            {
                ExistingSprints = existingSprints.ToHashSet(),
            };
        }

        // ---- Per-row validation, resolution and duplicate detection ----
        private (ImportRowResultDto Result, ServiceNowTicket? Entity) EvaluateRow(
            ExcelRow row,
            MasterData master,
            HashSet<int> seenSprints)
        {
            var result = new ImportRowResultDto
            {
                RowNumber = row.RowNumber,
                Sprint = row.Get(ColSprint),
                CriticalWeb = row.Get(ColCriticalWeb),
                Web = row.Get(ColWeb),
                CriticalMobile = row.Get(ColCriticalMobile),
                Mobile = row.Get(ColMobile),
                CompletionPercentage = row.Get(ColCompletionPercentage)
            };

            var entity = new ServiceNowTicket();

            // ---- Sprint (required) ----
            var sprint = ResolveSprint(row.Get(ColSprint), result.Errors);
            if (sprint.HasValue)
            {
                entity.Sprint = sprint.Value;
            }

            // ---- Integer ticket counts (required, non-negative) ----
            if (TryValidateInt(row.Get(ColCriticalWeb), "CriticalWeb", result.Errors, out var criticalWeb))
            {
                entity.CriticalWeb = criticalWeb;
            }

            if (TryValidateInt(row.Get(ColWeb), "Web", result.Errors, out var web))
            {
                entity.Web = web;
            }

            if (TryValidateInt(row.Get(ColCriticalMobile), "CriticalMobile", result.Errors, out var criticalMobile))
            {
                entity.CriticalMobile = criticalMobile;
            }

            if (TryValidateInt(row.Get(ColMobile), "Mobile", result.Errors, out var mobile))
            {
                entity.Mobile = mobile;
            }

            // ---- Completion Percentage (required, 0-100) ----
            if (TryValidatePercentage(row.Get(ColCompletionPercentage), result.Errors, out var completion))
            {
                entity.CompletionPercentage = completion;
            }

            if (result.Errors.Count > 0)
            {
                result.Status = ImportRowStatus.Invalid;
                return (result, null);
            }

            // Duplicate against the database or an earlier row in the same file.
            if (master.ExistingSprints.Contains(sprint!.Value) || !seenSprints.Add(sprint.Value))
            {
                result.Status = ImportRowStatus.Duplicate;
                result.Errors.Add(
                    $"Duplicate ServiceNow ticket data already exists for Sprint {sprint.Value}.");
                return (result, null);
            }

            result.Status = ImportRowStatus.New;
            return (result, entity);
        }

        // Resolve an Excel sprint value ("S10"/"10") to a positive sprint number.
        private int? ResolveSprint(string? value, List<string> errors)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                errors.Add("Sprint cannot be empty.");
                return null;
            }

            var match = SprintRegex.Match(value.Trim());
            if (!match.Success
                || !int.TryParse(match.Groups[1].Value, out var number)
                || number <= 0)
            {
                errors.Add($"Invalid Sprint '{value}'.");
                return null;
            }

            return number;
        }

        private static bool TryValidateInt(string? value, string fieldName, List<string> errors, out int result)
        {
            result = 0;
            if (string.IsNullOrWhiteSpace(value))
            {
                errors.Add($"{fieldName} cannot be empty.");
                return false;
            }

            if (!double.TryParse(value.Trim(), NumberStyles.Any, CultureInfo.InvariantCulture, out var number)
                || number != Math.Floor(number))
            {
                errors.Add($"Invalid {fieldName} '{value}'. A whole number is required.");
                return false;
            }

            if (number < 0)
            {
                errors.Add($"{fieldName} cannot be negative.");
                return false;
            }

            result = (int)number;
            return true;
        }

        private static bool TryValidatePercentage(string? value, List<string> errors, out decimal result)
        {
            result = 0m;
            if (string.IsNullOrWhiteSpace(value))
            {
                errors.Add("CompletionPercentage cannot be empty.");
                return false;
            }

            if (!decimal.TryParse(value.Trim(), NumberStyles.Any, CultureInfo.InvariantCulture, out var number))
            {
                errors.Add($"Invalid CompletionPercentage '{value}'. A number is required.");
                return false;
            }

            if (number < 0 || number > 100)
            {
                errors.Add("CompletionPercentage must be between 0 and 100.");
                return false;
            }

            result = number;
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
            public HashSet<int> ExistingSprints { get; init; } = new();

            public static MasterData Empty => new();
        }
    }
}
