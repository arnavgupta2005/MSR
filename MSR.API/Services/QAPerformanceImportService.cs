using System.Globalization;
using Microsoft.EntityFrameworkCore;
using MSR.API.Data;
using MSR.API.DTOs.Admin;
using MSR.API.Models;

namespace MSR.API.Services
{
    public class QAPerformanceImportService : IQAPerformanceImportService
    {
        private readonly MSRDbContext _context;
        private readonly IExcelReaderService _excel;

        private const string ImportType = "QA Performance";

        public QAPerformanceImportService(
            MSRDbContext context,
            IExcelReaderService excel)
        {
            _context = context;
            _excel = excel;
        }

        // ---- Foreign-key columns (canonical header -> display name) ----
        private const string ColSprint = "sprint";
        private const string ColName = "name";
        private const string ColProduct = "product";
        private const string ColDip1 = "dip1(headcount)";
        private const string ColDip2 = "dip2(completion)";
        private const string ColDip3 = "dip3(rollovers)";
        private const string ColDip4 = "dip4(planned items/delivered items)";
        private const string ColDip5 = "dip5(assigned/delivered points/velocity)";

        // ---- Integer metric columns: canonical header, display name, setter ----
        private static readonly (string Canonical, string Display, Action<QAPerformance, int> Set)[] IntColumns =
        {
            ("working days", "Working Days", (e, v) => e.QAWorkingDays = v),
            ("capacity", "Capacity", (e, v) => e.QACapacity = v),
            ("assigned points", "Assigned Points", (e, v) => e.AssignedPoints = v),
            ("delivered points", "Delivered Points", (e, v) => e.QADeliveredPoints = v),
            ("rollovers", "Rollovers", (e, v) => e.Rollover = v),
            ("rollover points", "Rollover Points", (e, v) => e.QARolloverPoints = v),
            ("iterations", "Iterations", (e, v) => e.QAIterations = v),
            ("observations", "Observations", (e, v) => e.QAObservations = v),
        };

        // ---- Numeric columns stored in an int? column (rounded to nearest int) ----
        private static readonly (string Canonical, string Display, Action<QAPerformance, int> Set)[] DecimalColumns =
        {
            ("average velocity", "Average Velocity", (e, v) => e.AverageVelocity = v),
        };

        // ---- Optional DIP text columns: canonical header, display name, setter ----
        private static readonly (string Canonical, string Display, Action<QAPerformance, string?> Set)[] DipColumns =
        {
            (ColDip1, "Dip1(headcount)", (e, v) => e.Dip1Headcount = v),
            (ColDip2, "Dip2(Completion)", (e, v) => e.Dip2Completion = v),
            (ColDip3, "Dip3(Rollovers)", (e, v) => e.Dip3Rollovers = v),
            (ColDip4, "Dip4(planned items/Delivered Items)", (e, v) => e.Dip4PlannedItemsDeliveredItems = v),
            (ColDip5, "Dip5(Assigned/Delivered Points/Velocity)", (e, v) => e.Dip5AssignedDeliveredPointsVelocity = v),
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
            var toInsert = new List<QAPerformance>();

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

            // Invalid rows are skipped; the valid new rows are still imported.
            if (toInsert.Count == 0)
            {
                result.Success = true;
                result.Message = result.InvalidRows > 0
                    ? $"No new records were imported. {result.InvalidRows} invalid row(s) were skipped."
                    : "No new records to import. All rows already exist.";
                // Import history recording deferred - to be implemented later.
                return result;
            }

            await using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                await _context.QAPerformances.AddRangeAsync(toInsert);
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
            result.Message = result.InvalidRows > 0
                ? $"Successfully imported {toInsert.Count} new record(s). {result.InvalidRows} invalid row(s) were skipped."
                : $"Successfully imported {toInsert.Count} new record(s).";

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
                (ColName, "Name"),
                (ColProduct, "Product"),
            };
            expected.AddRange(IntColumns.Select(c => (c.Canonical, c.Display)));
            expected.AddRange(DecimalColumns.Select(c => (c.Canonical, c.Display)));
            expected.AddRange(DipColumns.Select(c => (c.Canonical, c.Display)));

            var missing = expected
                .Where(c => !present.Contains(c.Canonical))
                .Select(c => c.Display)
                .ToList();

            if (missing.Count > 0)
            {
                var list = string.Join(", ", missing);
                return new List<string>
                {
                    $"Invalid QA Performance Excel. Missing columns: {list}."
                };
            }

            return new List<string>();
        }

        private async Task<MasterData> LoadMasterDataAsync()
        {
            var sprints = await _context.Sprints.AsNoTracking().ToListAsync();
            var products = await _context.ProductAreas.AsNoTracking().ToListAsync();
            var employees = await _context.Employees.AsNoTracking().ToListAsync();

            var existingKeys = await _context.QAPerformances
                .AsNoTracking()
                .Select(x => new { x.SprintId, x.EmployeeId, x.ProductAreaId })
                .ToListAsync();

            return new MasterData
            {
                SprintByNumber = sprints
                    .GroupBy(s => s.SprintNumber)
                    .ToDictionary(g => g.Key, g => g.First()),
                ProductByName = products
                    .GroupBy(p => _excel.Canonicalize(p.ProductAreaName))
                    .ToDictionary(g => g.Key, g => g.First()),
                EmployeesByName = employees
                    .GroupBy(e => _excel.Canonicalize(e.EmployeeName))
                    .ToDictionary(g => g.Key, g => g.ToList()),
                NewEmployeesByName = new Dictionary<string, Employee>(),
                ExistingKeys = existingKeys
                    .Select(k => (k.SprintId, k.EmployeeId, k.ProductAreaId))
                    .ToHashSet(),
            };
        }

        // ---- Per-row validation, FK resolution and duplicate detection ----
        private (ImportRowResultDto Result, QAPerformance? Entity) EvaluateRow(
            ExcelRow row,
            MasterData master,
            HashSet<(string, string, int)> seenKeys)
        {
            var result = new ImportRowResultDto
            {
                RowNumber = row.RowNumber,
                Sprint = row.Get(ColSprint),
                Employee = row.Get(ColName),
                Product = row.Get(ColProduct)
            };

            var entity = new QAPerformance();

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
            var sprint = ResolveSprint(row.Get(ColSprint), master, result.Errors);
            var product = ResolveProduct(row.Get(ColProduct), master, result.Errors);
            var employee = ResolveEmployee(row.Get(ColName), master, result.Errors);

            // DIP values are sprint-scoped: capture once from the first row seen
            // for a sprint and reuse for every row of that sprint.
            if (sprint is not null)
            {
                var sprintDipKey = GetSprintDipKey(sprint);
                if (!master.SprintDipValuesByKey.TryGetValue(sprintDipKey, out var dipValues))
                {
                    dipValues = DipValues.FromRow(row);
                    master.SprintDipValuesByKey[sprintDipKey] = dipValues;
                }

                dipValues.ApplyTo(entity);
            }

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

            // Existing employees are referenced by id; unknown employees are
            // created during import by attaching the new (untracked) entity.
            string employeeKey;
            if (employee!.EmployeeId != 0)
            {
                entity.EmployeeId = employee.EmployeeId;
                employeeKey = employee.EmployeeId.ToString(CultureInfo.InvariantCulture);

                // Only compare against DB duplicates when the sprint already exists.
                if (sprint.SprintId != 0)
                {
                    var dbKey = (sprint.SprintId, employee.EmployeeId, entity.ProductAreaId);
                    if (master.ExistingKeys.Contains(dbKey))
                    {
                        result.Status = ImportRowStatus.Duplicate;
                        result.Errors.Add(
                            $"Duplicate record already exists for Sprint {result.Sprint}, " +
                            $"Employee {result.Employee}, Product {result.Product}.");
                        return (result, null);
                    }
                }
            }
            else
            {
                entity.Employee = employee;
                employeeKey = "new:" + _excel.Canonicalize(employee.EmployeeName);
            }

            // Duplicate against an earlier row in the same file.
            var key = (sprintKey, employeeKey, entity.ProductAreaId);
            if (!seenKeys.Add(key))
            {
                result.Status = ImportRowStatus.Duplicate;
                result.Errors.Add(
                    $"Duplicate record already exists for Sprint {result.Sprint}, " +
                    $"Employee {result.Employee}, Product {result.Product}.");
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

        private Employee? ResolveEmployee(string? value, MasterData master, List<string> errors)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                errors.Add("Name cannot be empty.");
                return null;
            }

            var canonical = _excel.Canonicalize(value);

            if (master.EmployeesByName.TryGetValue(canonical, out var matches))
            {
                if (matches.Count > 1)
                {
                    errors.Add($"Employee '{value}' is ambiguous (matches multiple records).");
                    return null;
                }

                return matches[0];
            }

            // Unknown employee: create a new one (reused across rows in this file).
            if (!master.NewEmployeesByName.TryGetValue(canonical, out var created))
            {
                created = new Employee { EmployeeName = value.Trim() };
                master.NewEmployeesByName[canonical] = created;
            }

            return created;
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

        private static string GetSprintDipKey(Sprint sprint)
            => sprint.SprintId != 0
                ? sprint.SprintId.ToString(CultureInfo.InvariantCulture)
                : "new:" + sprint.SprintNumber.ToString(CultureInfo.InvariantCulture);

        private sealed class DipValues
        {
            public string? Dip1Headcount { get; init; }
            public string? Dip2Completion { get; init; }
            public string? Dip3Rollovers { get; init; }
            public string? Dip4PlannedItemsDeliveredItems { get; init; }
            public string? Dip5AssignedDeliveredPointsVelocity { get; init; }

            public static DipValues FromRow(ExcelRow row) => new()
            {
                Dip1Headcount = row.Get(ColDip1),
                Dip2Completion = row.Get(ColDip2),
                Dip3Rollovers = row.Get(ColDip3),
                Dip4PlannedItemsDeliveredItems = row.Get(ColDip4),
                Dip5AssignedDeliveredPointsVelocity = row.Get(ColDip5),
            };

            public void ApplyTo(QAPerformance entity)
            {
                entity.Dip1Headcount = Dip1Headcount;
                entity.Dip2Completion = Dip2Completion;
                entity.Dip3Rollovers = Dip3Rollovers;
                entity.Dip4PlannedItemsDeliveredItems = Dip4PlannedItemsDeliveredItems;
                entity.Dip5AssignedDeliveredPointsVelocity = Dip5AssignedDeliveredPointsVelocity;
            }
        }

        private sealed class MasterData
        {
            public Dictionary<int, Sprint> SprintByNumber { get; init; } = new();
            public Dictionary<string, ProductArea> ProductByName { get; init; } = new();
            public Dictionary<string, List<Employee>> EmployeesByName { get; init; } = new();
            public Dictionary<int, Sprint> NewSprintsByNumber { get; init; } = new();
            public Dictionary<string, Employee> NewEmployeesByName { get; init; } = new();
            public HashSet<(int, int, int)> ExistingKeys { get; init; } = new();
            public Dictionary<string, DipValues> SprintDipValuesByKey { get; init; } = new();

            public static MasterData Empty => new();
        }
    }
}
