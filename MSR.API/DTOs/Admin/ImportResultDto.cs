namespace MSR.API.DTOs.Admin
{
    // Result of the final commit (import) operation.
    public class ImportResultDto
    {
        public bool Success { get; set; }

        public string Message { get; set; } = string.Empty;

        public string FileName { get; set; } = string.Empty;

        public int TotalRows { get; set; }
        public int InsertedRows { get; set; }
        public int DuplicateRows { get; set; }
        public int InvalidRows { get; set; }

        public List<string> FileErrors { get; set; } = new();

        public List<ImportRowResultDto> Rows { get; set; } = new();
    }
}
