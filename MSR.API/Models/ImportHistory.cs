using System.ComponentModel.DataAnnotations;

namespace MSR.API.Models
{
    public class ImportHistory
    {
        [Key]
        public int ImportHistoryId { get; set; }

        public string FileName { get; set; } = string.Empty;

        public string ImportType { get; set; } = string.Empty;

        public string? UploadedBy { get; set; }

        public DateTime UploadedAt { get; set; }

        public int TotalRows { get; set; }

        public int InsertedRows { get; set; }

        public int DuplicateRows { get; set; }

        public int InvalidRows { get; set; }

        public string Status { get; set; } = string.Empty;
    }
}
