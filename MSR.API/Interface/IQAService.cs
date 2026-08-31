using MSR.API.DTOs.QA;

namespace MSR.API.Services
{
    public interface IQAService
    {
        Task<QAKpiDto> GetKpisAsync(
            QAKpiFilterDto filter);

        Task<List<QARolloverTrendDto>> GetRolloverTrendsAsync(
            QAPerformanceFilterDto filter);

        Task<List<QAStoryPointsTestedDto>> GetStoryPointsTestedAsync(
            QAPerformanceFilterDto filter);

        Task<List<QADeliveryTrendDto>> GetDeliveryTrendAsync(
            QAPerformanceFilterDto filter);
    }
}