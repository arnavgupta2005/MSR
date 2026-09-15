using Microsoft.AspNetCore.Mvc;
using MSR.API.DTOs.Admin;
using MSR.API.Services;

namespace MSR.API.Controllers;

[ApiController]
[Route("api/admin/import")]
public class AdminImportController : ControllerBase
{
    private readonly ISprintPerformanceImportService _sprintImport;
    private readonly IQAPerformanceImportService _qaPerformanceImport;
    private readonly IQADailyDeliveryImportService _qaDailyDeliveryImport;
    private readonly IQAUserStoryImportService _qaUserStoryImport;
    private readonly IFeatureReleaseImportService _featureReleaseImport;
    private readonly IImportHistoryService _history;

    // Reject oversized uploads early (10 MB is generous for these sheets).
    private const long MaxFileSizeBytes = 10 * 1024 * 1024;

    public AdminImportController(
        ISprintPerformanceImportService sprintImport,
        IQAPerformanceImportService qaPerformanceImport,
        IQADailyDeliveryImportService qaDailyDeliveryImport,
        IQAUserStoryImportService qaUserStoryImport,
        IFeatureReleaseImportService featureReleaseImport,
        IImportHistoryService history)
    {
        _sprintImport = sprintImport;
        _qaPerformanceImport = qaPerformanceImport;
        _qaDailyDeliveryImport = qaDailyDeliveryImport;
        _qaUserStoryImport = qaUserStoryImport;
        _featureReleaseImport = featureReleaseImport;
        _history = history;
    }

    // Validate a Sprint Performance Excel file and return a preview.
    [HttpPost("sprint-performance/validate")]
    [RequestSizeLimit(MaxFileSizeBytes)]
    public async Task<IActionResult> ValidateSprintPerformance(IFormFile? file)
    {
        var error = ValidateUpload(file);
        if (error is not null)
        {
            return BadRequest(new ImportPreviewDto
            {
                FileName = file?.FileName ?? string.Empty,
                ImportType = "Sprint Performance",
                FileErrors = { error }
            });
        }

        await using var stream = file!.OpenReadStream();
        var preview = await _sprintImport.ValidateAsync(stream, file.FileName);
        return Ok(preview);
    }

    // Commit the new rows from a Sprint Performance Excel file.
    [HttpPost("sprint-performance")]
    [RequestSizeLimit(MaxFileSizeBytes)]
    public async Task<IActionResult> ImportSprintPerformance(IFormFile? file)
    {
        var error = ValidateUpload(file);
        if (error is not null)
        {
            return BadRequest(new ImportResultDto
            {
                Success = false,
                FileName = file?.FileName ?? string.Empty,
                Message = error,
                FileErrors = { error }
            });
        }

        var uploadedBy = string.IsNullOrWhiteSpace(User.Identity?.Name)
            ? "Admin"
            : User.Identity!.Name;

        await using var stream = file!.OpenReadStream();
        var result = await _sprintImport.ImportAsync(stream, file.FileName, uploadedBy);
        return Ok(result);
    }

    // ---- QA Performance ----

    [HttpPost("qa-performance/validate")]
    [RequestSizeLimit(MaxFileSizeBytes)]
    public Task<IActionResult> ValidateQAPerformance(IFormFile? file)
        => RunValidate(file, "QA Performance", _qaPerformanceImport.ValidateAsync);

    [HttpPost("qa-performance")]
    [RequestSizeLimit(MaxFileSizeBytes)]
    public Task<IActionResult> ImportQAPerformance(IFormFile? file)
        => RunImport(file, _qaPerformanceImport.ImportAsync);

    // ---- QA Daily Delivery ----

    [HttpPost("qa-daily-delivery/validate")]
    [RequestSizeLimit(MaxFileSizeBytes)]
    public Task<IActionResult> ValidateQADailyDelivery(IFormFile? file)
        => RunValidate(file, "QA Daily Delivery", _qaDailyDeliveryImport.ValidateAsync);

    [HttpPost("qa-daily-delivery")]
    [RequestSizeLimit(MaxFileSizeBytes)]
    public Task<IActionResult> ImportQADailyDelivery(IFormFile? file)
        => RunImport(file, _qaDailyDeliveryImport.ImportAsync);

    // ---- QA User Story ----

    [HttpPost("qa-user-story/validate")]
    [RequestSizeLimit(MaxFileSizeBytes)]
    public Task<IActionResult> ValidateQAUserStory(IFormFile? file)
        => RunValidate(file, "QA User Story", _qaUserStoryImport.ValidateAsync);

    [HttpPost("qa-user-story")]
    [RequestSizeLimit(MaxFileSizeBytes)]
    public Task<IActionResult> ImportQAUserStory(IFormFile? file)
        => RunImport(file, _qaUserStoryImport.ImportAsync);

    // ---- Feature Release ----

    [HttpPost("feature-release/validate")]
    [RequestSizeLimit(MaxFileSizeBytes)]
    public Task<IActionResult> ValidateFeatureRelease(IFormFile? file)
        => RunValidate(file, "Feature Release", _featureReleaseImport.ValidateAsync);

    [HttpPost("feature-release")]
    [RequestSizeLimit(MaxFileSizeBytes)]
    public Task<IActionResult> ImportFeatureRelease(IFormFile? file)
        => RunImport(file, _featureReleaseImport.ImportAsync);

    // Shared validate handler for the QA import types.
    private async Task<IActionResult> RunValidate(
        IFormFile? file,
        string importType,
        Func<Stream, string, Task<ImportPreviewDto>> validate)
    {
        var error = ValidateUpload(file);
        if (error is not null)
        {
            return BadRequest(new ImportPreviewDto
            {
                FileName = file?.FileName ?? string.Empty,
                ImportType = importType,
                FileErrors = { error }
            });
        }

        await using var stream = file!.OpenReadStream();
        var preview = await validate(stream, file.FileName);
        return Ok(preview);
    }

    // Shared import handler for the QA import types.
    private async Task<IActionResult> RunImport(
        IFormFile? file,
        Func<Stream, string, string?, Task<ImportResultDto>> import)
    {
        var error = ValidateUpload(file);
        if (error is not null)
        {
            return BadRequest(new ImportResultDto
            {
                Success = false,
                FileName = file?.FileName ?? string.Empty,
                Message = error,
                FileErrors = { error }
            });
        }

        var uploadedBy = string.IsNullOrWhiteSpace(User.Identity?.Name)
            ? "Admin"
            : User.Identity!.Name;

        await using var stream = file!.OpenReadStream();
        var result = await import(stream, file.FileName, uploadedBy);
        return Ok(result);
    }

    // Import history across all import types.
    [HttpGet("history")]
    public async Task<IActionResult> GetHistory()
    {
        var history = await _history.GetHistoryAsync();
        return Ok(history);
    }

    private static string? ValidateUpload(IFormFile? file)
    {
        if (file is null || file.Length == 0)
        {
            return "No file was uploaded. Please choose a valid Excel (.xlsx) file.";
        }

        if (file.Length > MaxFileSizeBytes)
        {
            return "The file is too large. Maximum allowed size is 10 MB.";
        }

        var extension = Path.GetExtension(file.FileName)?.ToLowerInvariant();
        if (extension != ".xlsx")
        {
            return "Invalid file. Please upload a valid Excel (.xlsx) file.";
        }

        return null;
    }
}
