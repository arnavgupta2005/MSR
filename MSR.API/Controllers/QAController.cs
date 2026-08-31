using Microsoft.AspNetCore.Mvc;
using MSR.API.DTOs.QA;
using MSR.API.Services;

namespace MSR.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class QAController : ControllerBase
    {
        private readonly IQAService _qaService;

        public QAController(IQAService qaService)
        {
            _qaService = qaService;
        }

        // ========================================
        // QA KPIs
        // ========================================

        [HttpGet("kpis")]
        public async Task<ActionResult<QAKpiDto>> GetKpis(
            [FromQuery] QAKpiFilterDto filter)
        {
            var result = await _qaService.GetKpisAsync(filter);

            return Ok(result);
        }

        // ========================================
        // ROLLOVER TRENDS
        // ========================================

        [HttpGet("rollover-trends")]
        public async Task<ActionResult<List<QARolloverTrendDto>>> GetRolloverTrends(
            [FromQuery] QAPerformanceFilterDto filter)
        {
            var result = await _qaService.GetRolloverTrendsAsync(filter);

            return Ok(result);
        }

        // ========================================
        // STORY POINTS TESTED - QA WISE
        // ========================================

        [HttpGet("story-points-tested")]
        public async Task<ActionResult<List<QAStoryPointsTestedDto>>> GetStoryPointsTested(
            [FromQuery] QAPerformanceFilterDto filter)
        {
            var result = await _qaService.GetStoryPointsTestedAsync(filter);

            return Ok(result);
        }

        // ========================================
        // DAILY DELIVERY TREND
        // ========================================

        [HttpGet("delivery-trend")]
        public async Task<ActionResult<List<QADeliveryTrendDto>>> GetDeliveryTrend(
            [FromQuery] QAPerformanceFilterDto filter)
        {
            var result = await _qaService.GetDeliveryTrendAsync(filter);

            return Ok(result);
        }
    }
}