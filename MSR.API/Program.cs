using Microsoft.EntityFrameworkCore;
using MSR.API.Data;
using MSR.API.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // Serialize enums (e.g. import row status) as readable strings.
        options.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

builder.Services.AddCors(options =>
{
    options.AddPolicy("AngularClient", policy =>
    {
        policy
            .WithOrigins("http://localhost:4200")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddDbContext<MSRDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("MSRDatabase")));

builder.Services.AddScoped<ISprintPerformanceService, SprintPerformanceService>();
builder.Services.AddScoped<IQAService, QAService>();
builder.Services.AddScoped<IFeatureReleaseService, FeatureReleaseService>();

// Admin Excel import services
builder.Services.AddScoped<IExcelReaderService, ExcelReaderService>();
builder.Services.AddScoped<ISprintPerformanceImportService, SprintPerformanceImportService>();
builder.Services.AddScoped<IQAPerformanceImportService, QAPerformanceImportService>();
builder.Services.AddScoped<IQADailyDeliveryImportService, QADailyDeliveryImportService>();
builder.Services.AddScoped<IFeatureReleaseImportService, FeatureReleaseImportService>();


builder.Services.AddOpenApi();

var app = builder.Build();

// Configure the HTTP request pipeline.

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseCors("AngularClient");

app.UseAuthorization();

app.MapControllers();

app.Run();

