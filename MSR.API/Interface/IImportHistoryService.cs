using MSR.API.DTOs.Admin;

namespace MSR.API.Services
{
    public interface IImportHistoryService
    {
        Task RecordAsync(
            string fileName,
            string importType,
            string? uploadedBy,
            int totalRows,
            int insertedRows,
            int duplicateRows,
            int invalidRows,
            string status);

        Task<List<ImportHistoryDto>> GetHistoryAsync();
    }
}
