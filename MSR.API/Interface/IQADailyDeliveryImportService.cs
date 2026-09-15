using MSR.API.DTOs.Admin;

namespace MSR.API.Services
{
    public interface IQADailyDeliveryImportService
    {
        // Validate an uploaded QA Daily Delivery Excel file and return a preview.
        // Nothing is written to the database.
        Task<ImportPreviewDto> ValidateAsync(Stream stream, string fileName);

        // Re-validate and commit only the NEW rows inside a transaction.
        // Duplicates are skipped; invalid rows are rejected.
        Task<ImportResultDto> ImportAsync(Stream stream, string fileName, string? uploadedBy);
    }
}
