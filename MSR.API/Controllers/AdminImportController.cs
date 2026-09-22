using Microsoft.AspNetCore.Mvc;
using ClosedXML.Excel;
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
    private readonly IFeatureReleaseImportService _featureReleaseImport;
    private readonly IServiceNowTicketImportService _serviceNowTicketImport;

    // Reject oversized uploads early (10 MB is generous for these sheets).
    private const long MaxFileSizeBytes = 10 * 1024 * 1024;

    public AdminImportController(
        ISprintPerformanceImportService sprintImport,
        IQAPerformanceImportService qaPerformanceImport,
        IQADailyDeliveryImportService qaDailyDeliveryImport,
        IFeatureReleaseImportService featureReleaseImport,
        IServiceNowTicketImportService serviceNowTicketImport)
    {
        _sprintImport = sprintImport;
        _qaPerformanceImport = qaPerformanceImport;
        _qaDailyDeliveryImport = qaDailyDeliveryImport;
        _featureReleaseImport = featureReleaseImport;
        _serviceNowTicketImport = serviceNowTicketImport;
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

    // ---- Feature Release ----

    [HttpPost("feature-release/validate")]
    [RequestSizeLimit(MaxFileSizeBytes)]
    public Task<IActionResult> ValidateFeatureRelease(IFormFile? file)
        => RunValidate(file, "Feature Release", _featureReleaseImport.ValidateAsync);

    [HttpPost("feature-release")]
    [RequestSizeLimit(MaxFileSizeBytes)]
    public Task<IActionResult> ImportFeatureRelease(IFormFile? file)
        => RunImport(file, _featureReleaseImport.ImportAsync);

    // ---- ServiceNow Tickets ----

    [HttpPost("service-now-ticket/validate")]
    [RequestSizeLimit(MaxFileSizeBytes)]
    public Task<IActionResult> ValidateServiceNowTicket(IFormFile? file)
        => RunValidate(file, "ServiceNow Tickets", _serviceNowTicketImport.ValidateAsync);

    [HttpPost("service-now-ticket")]
    [RequestSizeLimit(MaxFileSizeBytes)]
    public Task<IActionResult> ImportServiceNowTicket(IFormFile? file)
        => RunImport(file, _serviceNowTicketImport.ImportAsync);

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

    // ---- Excel template downloads ----

    // Exact Sprint Performance columns expected by the importer (21 columns, in order).
    private static readonly string[] SprintPerformanceTemplateHeaders =
    {
        "Sprint", "Team Name", "Name", "Working Days", "Holidays", "Assigned Points",
        "Sprint Days", "Leaves", "Planned Items", "Delivered Items", "User Stories",
        "Bugs", "Rollover Points", "Rollovers", "Delivered Points", "Capacity",
        "Ideal Story Points", "Product", "Velocity", "Actual Velocity", "Trailing Velocity"
    };

    // Exact QA Performance columns expected by the importer (12 columns, in order).
    private static readonly string[] QAPerformanceTemplateHeaders =
    {
        "Sprint", "Name", "Working Days", "Capacity", "Average velocity", "Assigned Points",
        "Delivered Points", "Observations", "Rollover Points", "Rollovers", "Iterations", "Product"
    };

    // Feature Release columns expected by the importer (required + optional, in order).
    private static readonly string[] FeatureReleaseTemplateHeaders =
    {
        "Feature Description", "Planned Sprint", "Released Sprint", "Reason of delay", "Product"
    };

    // QA Daily Delivery columns expected by the importer (Intrics QA variant).
    private static readonly string[] QADailyDeliveryIntricsTemplateHeaders =
    {
        "Sprint", "Days", "Delivery", "Product"
    };

    // QA Daily Delivery columns for the InfoQuest QA variant (extra Web/Mobile column).
    private static readonly string[] QADailyDeliveryInfoQuestTemplateHeaders =
    {
        "Sprint", "Web/Mobile", "Days", "Delivery", "Product"
    };

    // ServiceNow Tickets columns expected by the importer (6 columns, in order).
    private static readonly string[] ServiceNowTicketTemplateHeaders =
    {
        "Sprint", "CriticalWeb", "Web", "CriticalMobile", "Mobile", "CompletionPercentage"
    };

    [HttpGet("sprint-performance/template")]
    public IActionResult DownloadSprintPerformanceTemplate()
        => BuildTemplate(SprintPerformanceTemplateHeaders, "Sprint Performance", "Sprint_Performance_Template.xlsx");

    [HttpGet("qa-performance/template")]
    public IActionResult DownloadQAPerformanceTemplate()
        => BuildTemplate(QAPerformanceTemplateHeaders, "QA Performance", "QA_Performance_Template.xlsx");

    [HttpGet("feature-release/template")]
    public IActionResult DownloadFeatureReleaseTemplate()
        => BuildTemplate(FeatureReleaseTemplateHeaders, "Feature Release", "Feature_Release_Template.xlsx");

    [HttpGet("qa-daily-delivery/template/intrics")]
    public IActionResult DownloadQADailyDeliveryIntricsTemplate()
        => BuildTemplate(QADailyDeliveryIntricsTemplateHeaders, "Intrics QA", "Intrics_QA_Daily_Delivery_Template.xlsx");

    [HttpGet("qa-daily-delivery/template/infoquest")]
    public IActionResult DownloadQADailyDeliveryInfoQuestTemplate()
        => BuildTemplate(QADailyDeliveryInfoQuestTemplateHeaders, "InfoQuest QA", "InfoQuest_QA_Daily_Delivery_Template.xlsx");

    [HttpGet("service-now-ticket/template")]
    public IActionResult DownloadServiceNowTicketTemplate()
        => BuildTemplate(ServiceNowTicketTemplateHeaders, "ServiceNow Tickets", "ServiceNow_Tickets_Template.xlsx");

    // Build a header-only .xlsx template from the given column list.
    private static FileContentResult BuildTemplate(string[] headers, string sheetName, string fileName)
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.Worksheets.Add(sheetName);

        for (var i = 0; i < headers.Length; i++)
        {
            sheet.Cell(1, i + 1).Value = headers[i];
        }

        sheet.Row(1).Style.Font.Bold = true;

        using var memory = new MemoryStream();
        workbook.SaveAs(memory);

        return new FileContentResult(
            memory.ToArray(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        {
            FileDownloadName = fileName
        };
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
