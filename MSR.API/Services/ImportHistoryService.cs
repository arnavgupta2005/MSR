using Microsoft.EntityFrameworkCore;
using MSR.API.Data;
using MSR.API.DTOs.Admin;
using MSR.API.Models;

namespace MSR.API.Services
{
    public class ImportHistoryService : IImportHistoryService
    {
        private readonly MSRDbContext _context;

        public ImportHistoryService(MSRDbContext context)
        {
            _context = context;
        }

        public async Task RecordAsync(
            string fileName,
            string importType,
            string? uploadedBy,
            int totalRows,
            int insertedRows,
            int duplicateRows,
            int invalidRows,
            string status)
        {
            var entry = new ImportHistory
            {
                FileName = fileName,
                ImportType = importType,
                UploadedBy = uploadedBy,
                UploadedAt = DateTime.Now,
                TotalRows = totalRows,
                InsertedRows = insertedRows,
                DuplicateRows = duplicateRows,
                InvalidRows = invalidRows,
                Status = status
            };

            _context.ImportHistories.Add(entry);
            await _context.SaveChangesAsync();
        }

        public async Task<List<ImportHistoryDto>> GetHistoryAsync()
        {
            return await _context.ImportHistories
                .AsNoTracking()
                .OrderByDescending(x => x.UploadedAt)
                .Select(x => new ImportHistoryDto
                {
                    ImportHistoryId = x.ImportHistoryId,
                    FileName = x.FileName,
                    ImportType = x.ImportType,
                    UploadedBy = x.UploadedBy,
                    UploadedAt = x.UploadedAt,
                    TotalRows = x.TotalRows,
                    InsertedRows = x.InsertedRows,
                    DuplicateRows = x.DuplicateRows,
                    InvalidRows = x.InvalidRows,
                    Status = x.Status
                })
                .ToListAsync();
        }
    }
}
