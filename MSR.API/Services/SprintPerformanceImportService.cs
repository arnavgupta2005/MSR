using System.Globalization;
using Microsoft.EntityFrameworkCore;
using MSR.API.Data;
using MSR.API.DTOs.Admin;
using MSR.API.Models;

namespace MSR.API.Services
{
    public class SprintPerformanceImportService : ISprintPerformanceImportService
    {
        private readonly MSRDbContext _context;
        private readonly IExcelReaderService _excel;
        private readonly IImportHistoryService _history;

        private const string ImportType = "Sprint Performance";

        public SprintPerformanceImportService(
            MSRDbContext context,
            IExcelReaderService excel,
            IImportHistoryService history)
        {
            _context = context;
            _excel = excel;
            _history = history;
        }

        // ---- Foreign-key columns (canonical header -> display name) ----
        private const string ColSprint = "sprint";
        private const string ColTeam = "team name";
        private const string ColName = "name";
        private const string ColProduct = "product";

        // ---- Integer metric columns: canonical header, display name, setter ----
        private static readonly (string Canonical, string Display, Action<SprintPerformance, int> Set)[] IntColumns =
        {
            ("working days", "Working Days", (e, v) => e.WorkingDays = v),
            ("holidays", "Holidays", (e, v) => e.Holidays = v),
            ("leaves", "Leaves", (e, v) => e.Leaves = v),
            ("sprint days", "Sprint Days", (e, v) => e.SprintDays = v),
            ("capacity", "Capacity", (e, v) => e.Capacity = v),
            ("assigned points", "Assigned Points", (e, v) => e.AssignedPoints = v),
            ("delivered points", "Delivered Points", (e, v) => e.DeliveredPoints = v),
            ("planned items", "Planned Items", (e, v) => e.PlannedItems = v),
            ("delivered items", "Delivered Items", (e, v) => e.DeliveredItems = v),
            ("user stories", "User Stories", (e, v) => e.UserStories = v),
            ("bugs", "Bugs", (e, v) => e.Bugs = v),
            ("rollovers", "Rollovers", (e, v) => e.Rollover = v),
            ("rollover points", "Rollover Points", (e, v) => e.RolloverPoints = v),
            ("ideal story points", "Ideal Story Points", (e, v) => e.IdealStoryPoints = v),
            ("velocity", "Velocity", (e, v) => e.Velocity = v),
        };

        // ---- Numeric columns stored in an int? column (rounded to nearest int) ----
        private static readonly (string Canonical, string Display, Action<SprintPerformance, int> Set)[] DecimalColumns =
        {
            ("actual velocity", "Actual Velocity", (e, v) => e.ActualVelocity = v),
            ("trailing velocity", "Trailing Velocity", (e, v) => e.TrailingVelocity = v),
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

            var seenKeys = new HashSet<(int, int, int, int)>();
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

            var seenKeys = new HashSet<(int, int, int, int)>();
            var toInsert = new List<SprintPerformance>();

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
                await _context.SprintPerformances.AddRangeAsync(toInsert);
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
                (ColTeam, "Team Name"),
                (ColName, "Name"),
                (ColProduct, "Product"),
            };
            expected.AddRange(IntColumns.Select(c => (c.Canonical, c.Display)));
            expected.AddRange(DecimalColumns.Select(c => (c.Canonical, c.Display)));

            var missing = expected
                .Where(c => !present.Contains(c.Canonical))
                .Select(c => c.Display)
                .ToList();

            if (missing.Count > 0)
            {
                var list = string.Join(", ", missing);
                return new List<string>
                {
                    $"Invalid Sprint Performance Excel. Missing columns: {list}."
                };
            }

            return new List<string>();
        }

        private async Task<MasterData> LoadMasterDataAsync()
        {
            var sprints = await _context.Sprints.AsNoTracking().ToListAsync();
            var teams = await _context.Teams.AsNoTracking().ToListAsync();
            var products = await _context.ProductAreas.AsNoTracking().ToListAsync();
            var employees = await _context.Employees.AsNoTracking().ToListAsync();

            var existingKeys = await _context.SprintPerformances
                .AsNoTracking()
                .Select(x => new { x.SprintId, x.TeamId, x.EmployeeId, x.ProductAreaId })
                .ToListAsync();

            return new MasterData
            {
                SprintByNumber = sprints
                    .GroupBy(s => s.SprintNumber)
                    .ToDictionary(g => g.Key, g => g.First().SprintId),
                TeamByName = teams
                    .GroupBy(t => _excel.Canonicalize(t.TeamName))
                    .ToDictionary(g => g.Key, g => g.First()),
                ProductByName = products
                    .GroupBy(p => _excel.Canonicalize(p.ProductAreaName))
                    .ToDictionary(g => g.Key, g => g.First()),
                Employees = employees,
                EmployeeNames = employees
                    .Select(e => _excel.Canonicalize(e.EmployeeName))
                    .ToHashSet(),
                ExistingKeys = existingKeys
                    .Select(k => (k.SprintId, k.TeamId, k.EmployeeId, k.ProductAreaId))
                    .ToHashSet(),
            };
        }

        // ---- Per-row validation, FK resolution and duplicate detection ----
        private (ImportRowResultDto Result, SprintPerformance? Entity) EvaluateRow(
            ExcelRow row,
            MasterData master,
            HashSet<(int, int, int, int)> seenKeys)
        {
            var result = new ImportRowResultDto
            {
                RowNumber = row.RowNumber,
                Sprint = row.Get(ColSprint),
                Team = row.Get(ColTeam),
                Employee = row.Get(ColName),
                Product = row.Get(ColProduct)
            };

            var entity = new SprintPerformance();

            // ---- Integer metric columns: required, numeric, non-negative ----
            foreach (var col in IntColumns)
            {
                if (TryValidateInt(row.Get(col.Canonical), col.Display, result.Errors, out var value))
                {
                    col.Set(entity, value);
                }
            }

            // ---- Decimal columns (stored rounded into int? columns) ----
            foreach (var col in DecimalColumns)
            {
                if (TryValidateDecimal(row.Get(col.Canonical), col.Display, result.Errors, out var value))
                {
                    col.Set(entity, (int)Math.Round(value, MidpointRounding.AwayFromZero));
                }
            }

            // ---- Foreign keys ----
            var sprintId = ResolveSprint(row.Get(ColSprint), master, result.Errors);
            var team = ResolveTeam(row.Get(ColTeam), master, result.Errors);
            var product = ResolveProduct(row.Get(ColProduct), master, result.Errors);
            var employeeId = ResolveEmployee(row.Get(ColName), team, master, result.Errors);

            if (result.Errors.Count > 0)
            {
                result.Status = ImportRowStatus.Invalid;
                return (result, null);
            }

            entity.SprintId = sprintId!.Value;
            entity.TeamId = team!.TeamId;
            entity.ProductAreaId = product!.ProductAreaId;
            entity.EmployeeId = employeeId!.Value;

            var key = (entity.SprintId, entity.TeamId, entity.EmployeeId, entity.ProductAreaId);

            // Duplicate against the database or an earlier row in the same file.
            if (master.ExistingKeys.Contains(key) || !seenKeys.Add(key))
            {
                result.Status = ImportRowStatus.Duplicate;
                result.Errors.Add(
                    $"Duplicate record already exists for Sprint {result.Sprint}, " +
                    $"Team {result.Team}, Employee {result.Employee}, Product {result.Product}.");
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

        private Team? ResolveTeam(string? value, MasterData master, List<string> errors)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                errors.Add("Team Name cannot be empty.");
                return null;
            }

            if (!master.TeamByName.TryGetValue(_excel.Canonicalize(value), out var team))
            {
                errors.Add($"Team '{value}' does not exist in the database.");
                return null;
            }

            return team;
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
                errors.Add($"Product '{value}' does not exist in the database.");
                return null;
            }

            return product;
        }

        private int? ResolveEmployee(string? value, Team? team, MasterData master, List<string> errors)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                errors.Add("Name cannot be empty.");
                return null;
            }

            // Team must resolve first to disambiguate employees by team.
            if (team is null)
            {
                return null;
            }

            var canonicalName = _excel.Canonicalize(value);
            var match = master.Employees.FirstOrDefault(e =>
                _excel.Canonicalize(e.EmployeeName) == canonicalName && e.TeamId == team.TeamId);

            if (match is not null)
            {
                return match.EmployeeId;
            }

            if (master.EmployeeNames.Contains(canonicalName))
            {
                errors.Add($"Employee '{value}' does not belong to team '{team.TeamName}'.");
            }
            else
            {
                errors.Add($"Employee '{value}' not found.");
            }

            return null;
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

        private static bool TryValidateDecimal(string? value, string display, List<string> errors, out decimal result)
        {
            result = 0;
            if (string.IsNullOrWhiteSpace(value))
            {
                errors.Add($"{display} cannot be empty.");
                return false;
            }

            if (!decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var number))
            {
                errors.Add($"{display} must be a valid number.");
                return false;
            }

            if (number < 0)
            {
                errors.Add($"{display} cannot be negative.");
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
            public Dictionary<int, int> SprintByNumber { get; init; } = new();
            public Dictionary<string, Team> TeamByName { get; init; } = new();
            public Dictionary<string, ProductArea> ProductByName { get; init; } = new();
            public List<Employee> Employees { get; init; } = new();
            public HashSet<string> EmployeeNames { get; init; } = new();
            public HashSet<(int, int, int, int)> ExistingKeys { get; init; } = new();

            public static MasterData Empty => new();
        }
    }
}
