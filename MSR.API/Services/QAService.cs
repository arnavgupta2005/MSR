using Microsoft.EntityFrameworkCore;
using MSR.API.Data;
using MSR.API.DTOs.QA;

namespace MSR.API.Services
{
    public class QAService : IQAService
    {
        private readonly MSRDbContext _context;

        public QAService(MSRDbContext context)
        {
            _context = context;
        }

        // ========================================
        // QA KPIs
        // ========================================

        public async Task<QAKpiDto> GetKpisAsync(
            QAKpiFilterDto filter)
        {
            var performanceQuery = _context.QAPerformances
                .Where(q =>
                    q.ProductAreaId == filter.ProductAreaId &&
                    filter.SprintIds.Contains(q.SprintId));

            var userStoryQuery = _context.QAUserStories
                .Where(q =>
                    q.ProductAreaId == filter.ProductAreaId &&
                    filter.SprintIds.Contains(q.SprintId) &&
                    q.WorkItemType == "User Story");

            return new QAKpiDto
            {
                TotalStories = await userStoryQuery.CountAsync(),

                Capacity = await performanceQuery
                    .SumAsync(q => (int?)q.QACapacity) ?? 0,

                TotalStoryPoints = await performanceQuery
                    .SumAsync(q => (int?)q.AssignedPoints) ?? 0,

                Rollovers = await performanceQuery
                    .SumAsync(q => (int?)q.Rollover) ?? 0,

                RolloverPoints = await performanceQuery
                    .SumAsync(q => (int?)q.QARolloverPoints) ?? 0,

                Observations = await performanceQuery
                    .SumAsync(q => (int?)q.QAObservations) ?? 0
            };
        }

        // ========================================
        // ROLLOVER TRENDS
        // ========================================

        public async Task<List<QARolloverTrendDto>> GetRolloverTrendsAsync(
            QAPerformanceFilterDto filter)
        {
            return await _context.QAPerformances
                .Where(q =>
                    q.ProductAreaId == filter.ProductAreaId &&
                    q.Sprint!.SprintNumber >= filter.StartSprintNumber &&
                    q.Sprint!.SprintNumber <= filter.EndSprintNumber)
                .GroupBy(q => new
                {
                    q.SprintId,
                    q.Sprint!.SprintNumber
                })
                .Select(g => new QARolloverTrendDto
                {
                    SprintId = g.Key.SprintId,
                    SprintNumber = g.Key.SprintNumber,
                    RolloverPoints = g.Sum(q => q.QARolloverPoints ?? 0)
                })
                .OrderBy(x => x.SprintNumber)
                .ToListAsync();
        }

        // ========================================
        // STORY POINTS TESTED - QA WISE
        // ========================================

        public async Task<List<QAStoryPointsTestedDto>> GetStoryPointsTestedAsync(
            QAPerformanceFilterDto filter)
        {
            return await _context.QAPerformances
                .Where(q =>
                    q.ProductAreaId == filter.ProductAreaId &&
                    q.Sprint!.SprintNumber >= filter.StartSprintNumber &&
                    q.Sprint!.SprintNumber <= filter.EndSprintNumber)
                .Select(q => new QAStoryPointsTestedDto
                {
                    SprintId = q.SprintId,
                    SprintNumber = q.Sprint!.SprintNumber,

                    EmployeeId = q.EmployeeId,
                    EmployeeName = q.Employee!.EmployeeName,

                    DeliveredPoints = q.QADeliveredPoints ?? 0
                })
                .OrderBy(x => x.SprintNumber)
                .ThenBy(x => x.EmployeeName)
                .ToListAsync();
        }

        // ========================================
        // DAILY DELIVERY TREND
        // ========================================

        public async Task<List<QADeliveryTrendDto>> GetDeliveryTrendAsync(
            QAPerformanceFilterDto filter)
        {
            return await _context.QADailyDeliveries
                .Where(q =>
                    q.ProductAreaId == filter.ProductAreaId &&
                    q.Sprint!.SprintNumber >= filter.StartSprintNumber &&
                    q.Sprint!.SprintNumber <= filter.EndSprintNumber)
                .Select(q => new QADeliveryTrendDto
                {
                    SprintId = q.SprintId,
                    SprintNumber = q.Sprint!.SprintNumber,

                    Day = q.Day,
                    Delivery = q.Delivery ?? 0
                })
                .OrderBy(x => x.SprintNumber)
                .ThenBy(x => x.Day)
                .ToListAsync();
        }
    }
}