using System.Text.RegularExpressions;
using ClosedXML.Excel;

namespace MSR.API.Services
{
    public class ExcelReaderService : IExcelReaderService
    {
        private static readonly Regex WhitespaceRegex = new(@"\s+", RegexOptions.Compiled);

        public string Canonicalize(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return string.Empty;
            }

            return WhitespaceRegex.Replace(value.Trim(), " ").ToLowerInvariant();
        }

        public ExcelReadResult Read(Stream stream, string fileName)
        {
            var result = new ExcelReadResult();

            // ---- Extension validation: .xlsx only ----
            var extension = Path.GetExtension(fileName)?.ToLowerInvariant();
            if (extension != ".xlsx")
            {
                result.Error = "Invalid file. Please upload a valid Excel (.xlsx) file.";
                return result;
            }

            if (stream is null || stream.Length == 0)
            {
                result.Error = "The uploaded file is empty. Please upload a valid Excel (.xlsx) file.";
                return result;
            }

            XLWorkbook workbook;
            try
            {
                workbook = new XLWorkbook(stream);
            }
            catch
            {
                // Corrupted, password-protected or non-Excel content disguised as .xlsx.
                result.Error = "The file could not be read. It may be corrupted or not a valid Excel (.xlsx) file.";
                return result;
            }

            using (workbook)
            {
                var worksheet = workbook.Worksheets.FirstOrDefault();
                if (worksheet is null)
                {
                    result.Error = "The Excel file does not contain any worksheet.";
                    return result;
                }

                var usedRange = worksheet.RangeUsed();
                if (usedRange is null)
                {
                    result.Error = "The Excel file is empty. No data was found.";
                    return result;
                }

                var rows = usedRange.RowsUsed().ToList();
                if (rows.Count == 0)
                {
                    result.Error = "The Excel file is empty. No data was found.";
                    return result;
                }

                // ---- Header row ----
                var headerRow = rows[0];
                var headerCells = headerRow.Cells().ToList();
                var canonicalHeaders = new List<string>();

                foreach (var cell in headerCells)
                {
                    var raw = cell.GetString();
                    result.Headers.Add(raw?.Trim() ?? string.Empty);
                    canonicalHeaders.Add(Canonicalize(raw));
                }

                if (canonicalHeaders.All(string.IsNullOrEmpty))
                {
                    result.Error = "The Excel file does not contain a valid header row.";
                    return result;
                }

                // ---- Data rows ----
                foreach (var row in rows.Skip(1))
                {
                    var excelRow = new ExcelRow { RowNumber = row.RowNumber() };
                    var hasAnyValue = false;

                    for (var i = 0; i < canonicalHeaders.Count; i++)
                    {
                        var header = canonicalHeaders[i];
                        if (string.IsNullOrEmpty(header))
                        {
                            continue;
                        }

                        var text = row.Cell(i + 1).GetString();
                        var trimmed = string.IsNullOrWhiteSpace(text) ? null : text.Trim();
                        excelRow.Cells[header] = trimmed;

                        if (trimmed is not null)
                        {
                            hasAnyValue = true;
                        }
                    }

                    // Skip fully blank rows so trailing empty lines don't fail validation.
                    if (hasAnyValue)
                    {
                        result.Rows.Add(excelRow);
                    }
                }

                if (result.Rows.Count == 0)
                {
                    result.Error = "The Excel file does not contain any data rows.";
                    return result;
                }
            }

            return result;
        }
    }
}
