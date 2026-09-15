namespace MSR.API.Services
{
    // One parsed data row from an Excel worksheet.
    public class ExcelRow
    {
        // The actual worksheet row number (1-based) for user-facing messages.
        public int RowNumber { get; set; }

        // Header (canonicalized to lower-case, single-spaced) -> trimmed cell text.
        // Empty/whitespace cells are stored as null.
        public Dictionary<string, string?> Cells { get; set; } = new();

        public string? Get(string canonicalHeader)
            => Cells.TryGetValue(canonicalHeader, out var value) ? value : null;
    }

    // Result of reading a worksheet. When Error is set the file is rejected.
    public class ExcelReadResult
    {
        public string? Error { get; set; }
        public List<string> Headers { get; set; } = new();
        public List<ExcelRow> Rows { get; set; } = new();

        public bool IsValid => Error is null;
    }

    public interface IExcelReaderService
    {
        // Reads the first worksheet. Performs file-level validation only
        // (extension, non-empty, not corrupted, has a header + data rows).
        ExcelReadResult Read(Stream stream, string fileName);

        // Canonicalizes a header/name for case-insensitive comparison.
        string Canonicalize(string? value);
    }
}
