using Microsoft.EntityFrameworkCore;
using MSR.API.Data;
using MSR.API.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();

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

