using MSR.API.DTOs.SprintPerformance;

namespace MSR.API.Services
{
    public interface ISprintPerformanceService
    {
        Task<SprintPerformanceKpiDto> GetKpisAsync(
            SprintKpiFilterDto filter);

        Task<List<RolloverTrendDto>> GetRolloverTrendsAsync(
            SprintPerformanceFilterDto filter);

        Task<List<TeamRolloverTrendDto>> GetTeamRolloverTrendsAsync(
            SprintPerformanceFilterDto filter);

        Task<List<TeamVelocityHeadcountDto>> GetActualVelocityVsHeadcountAsync(
            SprintPerformanceFilterDto filter);

        Task<List<VelocityTrendDto>> GetVelocityTrendsAsync(
            SprintPerformanceFilterDto filter);

        Task<List<ResourceVelocityTrendDto>> GetResourceVelocityTrendsAsync(
            SprintPerformanceFilterDto filter);

        Task<List<TeamVelocityTrendDto>> GetTeamVelocityTrendsAsync(
            SprintPerformanceFilterDto filter);

        Task<List<TeamCompletionTrendDto>> GetTeamCompletionTrendsAsync(
            SprintPerformanceFilterDto filter);

        Task<List<ResourceCompletionDto>> GetResourceCompletionAsync(
            SprintPerformanceFilterDto filter);
    }
}