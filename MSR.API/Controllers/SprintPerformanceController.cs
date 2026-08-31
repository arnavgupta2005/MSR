using Microsoft.AspNetCore.Mvc;
using MSR.API.DTOs.SprintPerformance;
using MSR.API.Services;

namespace MSR.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SprintPerformanceController : ControllerBase
{
    private readonly ISprintPerformanceService _service;

    public SprintPerformanceController(
        ISprintPerformanceService service)
    {
        _service = service;
    }

    // 1. KPI Summary
    [HttpGet("kpis")]
    public async Task<IActionResult> GetKpis(
        [FromQuery] SprintKpiFilterDto filter)
    {
        var result = await _service.GetKpisAsync(filter);

        return Ok(result);
    }

    // 2. Rollover Trends Across Sprints
    [HttpGet("rollover-trends")]
    public async Task<IActionResult> GetRolloverTrends(
        [FromQuery] SprintPerformanceFilterDto filter)
    {
        var result =
            await _service.GetRolloverTrendsAsync(filter);

        return Ok(result);
    }

    // 3. Team-wise Rollover Trends
    [HttpGet("team-rollover-trends")]
    public async Task<IActionResult> GetTeamRolloverTrends(
        [FromQuery] SprintPerformanceFilterDto filter)
    {
        var result =
            await _service.GetTeamRolloverTrendsAsync(filter);

        return Ok(result);
    }

    // 4. Actual Velocity vs Headcount
    [HttpGet("actual-velocity-vs-headcount")]
    public async Task<IActionResult> GetActualVelocityVsHeadcount(
        [FromQuery] SprintPerformanceFilterDto filter)
    {
        var result =
            await _service.GetActualVelocityVsHeadcountAsync(filter);

        return Ok(result);
    }

    // 5. Velocity Trends
    [HttpGet("velocity-trends")]
    public async Task<IActionResult> GetVelocityTrends(
        [FromQuery] SprintPerformanceFilterDto filter)
    {
        var result =
            await _service.GetVelocityTrendsAsync(filter);

        return Ok(result);
    }

    // 6. Resource-wise Velocity Trends
    [HttpGet("resource-velocity-trends")]
    public async Task<IActionResult> GetResourceVelocityTrends(
        [FromQuery] SprintPerformanceFilterDto filter)
    {
        var result =
            await _service.GetResourceVelocityTrendsAsync(filter);

        return Ok(result);
    }

    // 7. Team-wise Velocity Trends
    [HttpGet("team-velocity-trends")]
    public async Task<IActionResult> GetTeamVelocityTrends(
        [FromQuery] SprintPerformanceFilterDto filter)
    {
        var result =
            await _service.GetTeamVelocityTrendsAsync(filter);

        return Ok(result);
    }

    // 8. Team Completion Trends
    [HttpGet("team-completion-trends")]
    public async Task<IActionResult> GetTeamCompletionTrends(
        [FromQuery] SprintPerformanceFilterDto filter)
    {
        var result =
            await _service.GetTeamCompletionTrendsAsync(filter);

        return Ok(result);
    }

    // 9. Resource Completion
    [HttpGet("resource-completion")]
    public async Task<IActionResult> GetResourceCompletion(
        [FromQuery] SprintPerformanceFilterDto filter)
    {
        var result =
            await _service.GetResourceCompletionAsync(filter);

        return Ok(result);
    }
}