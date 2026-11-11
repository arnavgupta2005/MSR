using System.Buffers.Binary;
using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using PdfSharpCore;
using PdfSharpCore.Drawing;
using PdfSharpCore.Pdf;

namespace MSR.API.Controllers;

[ApiController]
[Route("api/charts")]
public class ChartExportController : ControllerBase
{
    private const string PngDataUrlPrefix = "data:image/png;base64,";
    private const int MaxImageDataUrlLength = 11_000_000;
    private static readonly byte[] PngSignature = [137, 80, 78, 71, 13, 10, 26, 10];

    [HttpPost("pdf")]
    [RequestSizeLimit(12_000_000)]
    public ActionResult ExportPdf([FromBody] ChartPdfExportRequest request)
    {
        if (request.ImageDataUrl.Length > MaxImageDataUrlLength ||
            !request.ImageDataUrl.StartsWith(PngDataUrlPrefix, StringComparison.Ordinal))
        {
            return BadRequest("A PNG chart image is required.");
        }

        byte[] imageBytes;
        try
        {
            imageBytes = Convert.FromBase64String(request.ImageDataUrl[PngDataUrlPrefix.Length..]);
        }
        catch (FormatException)
        {
            return BadRequest("The chart image is invalid.");
        }

        if (!IsValidPng(imageBytes))
        {
            return BadRequest("The chart image is invalid or too large.");
        }

        using var document = new PdfDocument();
        document.Info.Title = request.Title;

        var page = document.AddPage();
        page.Orientation = PageOrientation.Landscape;
        using (var chartImage = XImage.FromStream(() => new MemoryStream(imageBytes)))
        {
            var margin = 28d;
            var availableWidth = page.Width.Point - margin * 2;
            var availableHeight = page.Height.Point - margin * 2;
            var scale = Math.Min(availableWidth / chartImage.PixelWidth, availableHeight / chartImage.PixelHeight);
            var width = chartImage.PixelWidth * scale;
            var height = chartImage.PixelHeight * scale;
            var x = (page.Width.Point - width) / 2;
            var y = (page.Height.Point - height) / 2;

            using var graphics = XGraphics.FromPdfPage(page);
            graphics.DrawImage(chartImage, x, y, width, height);
        }

        using var output = new MemoryStream();
        document.Save(output, false);

        var fileName = Regex.Replace(request.Title, "[^a-zA-Z0-9_-]+", "-").Trim('-');
        if (string.IsNullOrWhiteSpace(fileName))
        {
            fileName = "chart";
        }

        return File(output.ToArray(), "application/pdf", $"{fileName}.pdf");
    }

    private static bool IsValidPng(byte[] imageBytes)
    {
        if (imageBytes.Length < 24 || !imageBytes.AsSpan(0, PngSignature.Length).SequenceEqual(PngSignature))
        {
            return false;
        }

        var width = BinaryPrimitives.ReadUInt32BigEndian(imageBytes.AsSpan(16, 4));
        var height = BinaryPrimitives.ReadUInt32BigEndian(imageBytes.AsSpan(20, 4));
        return width > 0 && height > 0 && width <= 10_000 && height <= 10_000 && (ulong)width * height <= 50_000_000;
    }
}

public sealed class ChartPdfExportRequest
{
    [Required]
    [StringLength(120)]
    public string Title { get; init; } = string.Empty;

    [Required]
    public string ImageDataUrl { get; init; } = string.Empty;
}