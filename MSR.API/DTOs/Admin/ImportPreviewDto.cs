namespace MSR.API.DTOs.Admin
{
    // Full validation preview returned to the UI before the final import.
    public class ImportPreviewDto
    {
        public string FileName { get; set; } = string.Empty;

        public string ImportType { get; set; } = string.Empty;

        public int TotalRows { get; set; }
        public int NewRows { get; set; }
        public int DuplicateRows { get; set; }
        public int InvalidRows { get; set; }

        // File/structure level errors (e.g. wrong file type, missing columns).
        // When populated, the file is rejected outright and Rows is empty.
        public List<string> FileErrors { get; set; } = new();

        public List<ImportRowResultDto> Rows { get; set; } = new();
    }
}
