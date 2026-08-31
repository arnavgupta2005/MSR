using Microsoft.EntityFrameworkCore;
using MSR.API.Data;
using MSR.API.DTOs.SprintPerformance;
using MSR.API.Models;

namespace MSR.API.Services
{
    public class SprintPerformanceService : ISprintPerformanceService
    {
        private readonly MSRDbContext _context;

        public SprintPerformanceService(MSRDbContext context)
        {
            _context = context;
        }

        public async Task<SprintPerformanceKpiDto> GetKpisAsync(
            SprintKpiFilterDto filter)
        {
            var query = _context.SprintPerformances
    .AsNoTracking()
    .Where(x =>
        x.ProductAreaId == filter.ProductAreaId &&
        filter.SprintIds.Contains(x.SprintId));

            var data = await query.ToListAsync();

            // No data for the selected sprint(s)
            if (data.Count == 0)
            {
                return new SprintPerformanceKpiDto
                {
                    Capacity = null,
                    Velocity = null,
                    AssignedPoints = null,
                    DeliveredPoints = null,
                    Rollovers = null,
                    RolloverPoints = null,
                    PlannedItems = null,
                    DeliveredItems = null,
                    CompletionPercentage = null
                };
            }

            var capacity = data.Sum(x => x.Capacity ?? 0);
            var velocity = data.Sum(x => x.Velocity ?? 0);
            var assignedPoints = data.Sum(x => x.AssignedPoints ?? 0);
            var deliveredPoints = data.Sum(x => x.DeliveredPoints ?? 0);
            var rollovers = data.Sum(x => x.Rollover ?? 0);
            var rolloverPoints = data.Sum(x => x.RolloverPoints ?? 0);
            var plannedItems = data.Sum(x => x.PlannedItems ?? 0);
            var deliveredItems = data.Sum(x => x.DeliveredItems ?? 0);

            var completionPercentage = assignedPoints == 0
                ? 0
                : Math.Round(
                    (double)deliveredPoints / assignedPoints * 100,
                    1);

            return new SprintPerformanceKpiDto
            {
                Capacity = capacity,
                Velocity = velocity,
                AssignedPoints = assignedPoints,
                DeliveredPoints = deliveredPoints,
                Rollovers = rollovers,
                RolloverPoints = rolloverPoints,
                PlannedItems = plannedItems,
                DeliveredItems = deliveredItems,
                CompletionPercentage = completionPercentage
            };
        }

        public async Task<List<RolloverTrendDto>> GetRolloverTrendsAsync(
    SprintPerformanceFilterDto filter)
        {
            var data = await _context.SprintPerformances
                .AsNoTracking()
                .Include(x => x.Sprint)
                .Where(x =>
                    x.ProductAreaId == filter.ProductAreaId &&
                    x.Sprint != null &&
                    x.Sprint.SprintNumber >= filter.StartSprintNumber &&
                    x.Sprint.SprintNumber <= filter.EndSprintNumber)
                .GroupBy(x => new
                {
                    x.SprintId,
                    x.Sprint!.SprintNumber
                })
                .Select(g => new RolloverTrendDto
                {
                    SprintId = g.Key.SprintId,
                    SprintNumber = g.Key.SprintNumber,
                    Rollover = g.Sum(x => x.Rollover ?? 0),
                    RolloverPoints = g.Sum(x => x.RolloverPoints ?? 0)
                })
                .OrderBy(x => x.SprintNumber)
                .ToListAsync();

            return data;
        }


        public async Task<List<TeamRolloverTrendDto>> GetTeamRolloverTrendsAsync(
    SprintPerformanceFilterDto filter)
        {
            var data = await _context.SprintPerformances
                .AsNoTracking()
                .Include(x => x.Sprint)
                .Include(x => x.Team)
                .Where(x =>
                    x.ProductAreaId == filter.ProductAreaId &&
                    x.Sprint != null &&
                    x.Team != null &&
                    x.Sprint.SprintNumber >= filter.StartSprintNumber &&
                    x.Sprint.SprintNumber <= filter.EndSprintNumber)
                .GroupBy(x => new
                {
                    x.TeamId,
                    x.Team!.TeamName,
                    x.SprintId,
                    x.Sprint!.SprintNumber
                })
                .Select(g => new TeamRolloverTrendDto
                {
                    TeamId = g.Key.TeamId,
                    TeamName = g.Key.TeamName,
                    SprintId = g.Key.SprintId,
                    SprintNumber = g.Key.SprintNumber,
                    Rollover = g.Sum(x => x.Rollover ?? 0),
                    RolloverPoints = g.Sum(x => x.RolloverPoints ?? 0)
                })
                .OrderBy(x => x.SprintNumber)
                .ThenBy(x => x.TeamName)
                .ToListAsync();

            return data;
        }


        public async Task<List<TeamVelocityHeadcountDto>> GetActualVelocityVsHeadcountAsync(
    SprintPerformanceFilterDto filter)
        {
            var data = await _context.SprintPerformances
                .AsNoTracking()
                .Include(x => x.Sprint)
                .Include(x => x.Team)
                .Where(x =>
                    x.ProductAreaId == filter.ProductAreaId &&
                    x.Sprint != null &&
                    x.Team != null &&
                    x.Sprint.SprintNumber >= filter.StartSprintNumber &&
                    x.Sprint.SprintNumber <= filter.EndSprintNumber)
                .GroupBy(x => new
                {
                    x.TeamId,
                    x.Team!.TeamName,
                    x.SprintId,
                    x.Sprint!.SprintNumber
                })
                .Select(g => new TeamVelocityHeadcountDto
                {
                    TeamId = g.Key.TeamId,
                    TeamName = g.Key.TeamName,
                    SprintId = g.Key.SprintId,
                    SprintNumber = g.Key.SprintNumber,
                    ActualVelocity = g.Sum(x => x.ActualVelocity ?? 0),
                    Headcount = g.Select(x => x.EmployeeId).Distinct().Count()
                })
                .OrderBy(x => x.SprintNumber)
                .ThenBy(x => x.TeamName)
                .ToListAsync();

            return data;
        }

        public async Task<List<VelocityTrendDto>> GetVelocityTrendsAsync(
    SprintPerformanceFilterDto filter)
        {
            var data = await _context.SprintPerformances
                .AsNoTracking()
                .Include(x => x.Sprint)
                .Where(x =>
                x.ProductAreaId == filter.ProductAreaId &&

                    x.Sprint != null &&
                    x.Sprint.SprintNumber >= filter.StartSprintNumber &&
                    x.Sprint.SprintNumber <= filter.EndSprintNumber)
                .GroupBy(x => new
                {
                    x.SprintId,
                    x.Sprint!.SprintNumber
                })
                .Select(g => new VelocityTrendDto
                {
                    SprintId = g.Key.SprintId,
                    SprintNumber = g.Key.SprintNumber,
                    ActualVelocity = g.Sum(x => x.ActualVelocity ?? 0),
                    TrailingVelocity = g.Sum(x => x.TrailingVelocity ?? 0)
                })
                .OrderBy(x => x.SprintNumber)
                .ToListAsync();

            return data;
        }

        public async Task<List<ResourceVelocityTrendDto>> GetResourceVelocityTrendsAsync(
    SprintPerformanceFilterDto filter)
        {
            var data = await _context.SprintPerformances
                .AsNoTracking()
                .Include(x => x.Sprint)
                .Include(x => x.Employee)
                .Include(x => x.Team)
                .Where(x =>
                x.ProductAreaId == filter.ProductAreaId &&
                    x.Sprint != null &&
                    x.Employee != null &&
                    x.Team != null &&
                    x.Sprint.SprintNumber >= filter.StartSprintNumber &&
                    x.Sprint.SprintNumber <= filter.EndSprintNumber)
                .GroupBy(x => new
                {
                    x.EmployeeId,
                    x.Employee!.EmployeeName,
                    x.TeamId,
                    x.Team!.TeamName,
                    x.SprintId,
                    x.Sprint!.SprintNumber
                })
                .Select(g => new ResourceVelocityTrendDto
                {
                    EmployeeId = g.Key.EmployeeId,
                    EmployeeName = g.Key.EmployeeName,
                    TeamId = g.Key.TeamId,
                    TeamName = g.Key.TeamName,
                    SprintId = g.Key.SprintId,
                    SprintNumber = g.Key.SprintNumber,
                    ActualVelocity = g.Sum(x => x.ActualVelocity ?? 0),
                    AssignedPoints = g.Sum(x => x.AssignedPoints ?? 0),
                    Capacity = g.Sum(x => x.Capacity ?? 0),
                    TrailingVelocity = g.Sum(x => x.TrailingVelocity ?? 0)
                })
                .OrderBy(x => x.SprintNumber)
                .ThenBy(x => x.TeamName)
                .ThenBy(x => x.EmployeeName)
                .ToListAsync();

            return data;
        }

        public async Task<List<TeamVelocityTrendDto>> GetTeamVelocityTrendsAsync(
    SprintPerformanceFilterDto filter)
        {
            var data = await _context.SprintPerformances
                .AsNoTracking()
                .Include(x => x.Sprint)
                .Include(x => x.Team)
                .Where(x =>
                x.ProductAreaId == filter.ProductAreaId &&
                    x.Sprint != null &&
                    x.Team != null &&
                    x.Sprint.SprintNumber >= filter.StartSprintNumber &&
                    x.Sprint.SprintNumber <= filter.EndSprintNumber)
                .GroupBy(x => new
                {
                    x.TeamId,
                    x.Team!.TeamName,
                    x.SprintId,
                    x.Sprint!.SprintNumber
                })
                .Select(g => new TeamVelocityTrendDto
                {
                    TeamId = g.Key.TeamId,
                    TeamName = g.Key.TeamName,
                    SprintId = g.Key.SprintId,
                    SprintNumber = g.Key.SprintNumber,
                    ActualVelocity = g.Sum(x => x.ActualVelocity ?? 0),
                    Capacity = g.Sum(x => x.Capacity ?? 0),
                    TrailingVelocity = g.Sum(x => x.TrailingVelocity ?? 0)
                })
                .OrderBy(x => x.SprintNumber)
                .ThenBy(x => x.TeamName)
                .ToListAsync();

            return data;
        }

        public async Task<List<TeamCompletionTrendDto>> GetTeamCompletionTrendsAsync(
    SprintPerformanceFilterDto filter)
        {
            var data = await _context.SprintPerformances
                .AsNoTracking()
                .Include(x => x.Sprint)
                .Include(x => x.Team)
                .Where(x =>
                x.ProductAreaId == filter.ProductAreaId &&
                    x.Sprint != null &&
                    x.Team != null &&
                    x.Sprint.SprintNumber >= filter.StartSprintNumber &&
                    x.Sprint.SprintNumber <= filter.EndSprintNumber)
                .GroupBy(x => new
                {
                    x.TeamId,
                    x.Team!.TeamName,
                    x.SprintId,
                    x.Sprint!.SprintNumber
                })
                .Select(g => new
                {
                    g.Key.TeamId,
                    g.Key.TeamName,
                    g.Key.SprintId,
                    g.Key.SprintNumber,
                    AssignedPoints = g.Sum(x => x.AssignedPoints ?? 0),
                    DeliveredPoints = g.Sum(x => x.DeliveredPoints ?? 0)
                })
                .OrderBy(x => x.SprintNumber)
                .ThenBy(x => x.TeamName)
                .ToListAsync();

            return data.Select(x => new TeamCompletionTrendDto
            {
                TeamId = x.TeamId,
                TeamName = x.TeamName,
                SprintId = x.SprintId,
                SprintNumber = x.SprintNumber,
                AssignedPoints = x.AssignedPoints,
                DeliveredPoints = x.DeliveredPoints,
                CompletionPercentage = x.AssignedPoints == 0
    ? 0
    : Math.Round(
        (double)x.DeliveredPoints / x.AssignedPoints * 100,
        2
    )
            }).ToList();
        }

        public async Task<List<ResourceCompletionDto>> GetResourceCompletionAsync(
    SprintPerformanceFilterDto filter)
        {
            var data = await _context.SprintPerformances
                .AsNoTracking()
                .Include(x => x.Sprint)
                .Include(x => x.Employee)
                .Include(x => x.Team)
                .Where(x =>
                x.ProductAreaId == filter.ProductAreaId &&
                    x.Sprint != null &&
                    x.Employee != null &&
                    x.Team != null &&
                    x.Sprint.SprintNumber >= filter.StartSprintNumber &&
                    x.Sprint.SprintNumber <= filter.EndSprintNumber)
                .GroupBy(x => new
                {
                    x.EmployeeId,
                    x.Employee!.EmployeeName,
                    x.TeamId,
                    x.Team!.TeamName,
                    x.SprintId,
                    x.Sprint!.SprintNumber
                })
                .Select(g => new
                {
                    g.Key.EmployeeId,
                    g.Key.EmployeeName,
                    g.Key.TeamId,
                    g.Key.TeamName,
                    g.Key.SprintId,
                    g.Key.SprintNumber,
                    AssignedPoints = g.Sum(x => x.AssignedPoints ?? 0),
                    DeliveredPoints = g.Sum(x => x.DeliveredPoints ?? 0)
                })
                .OrderBy(x => x.SprintNumber)
                .ThenBy(x => x.TeamName)
                .ThenBy(x => x.EmployeeName)
                .ToListAsync();

            return data.Select(x => new ResourceCompletionDto
            {
                EmployeeId = x.EmployeeId,
                EmployeeName = x.EmployeeName,
                TeamId = x.TeamId,
                TeamName = x.TeamName,
                SprintId = x.SprintId,
                SprintNumber = x.SprintNumber,
                AssignedPoints = x.AssignedPoints,
                DeliveredPoints = x.DeliveredPoints,
                CompletionPercentage = x.AssignedPoints == 0
        ? 0
        : Math.Round(
            (double)x.DeliveredPoints / x.AssignedPoints * 100,
            2
        )
            }).ToList();
        }

    }
}