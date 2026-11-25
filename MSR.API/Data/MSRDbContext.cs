using Microsoft.EntityFrameworkCore;
using MSR.API.Models;

namespace MSR.API.Data;

public class MSRDbContext : DbContext
{
    public MSRDbContext(DbContextOptions<MSRDbContext> options)
        : base(options)
    {
    }

    public DbSet<Team> Teams { get; set; }
    public DbSet<Employee> Employees { get; set; }
    public DbSet<Sprint> Sprints { get; set; }
    public DbSet<ProductArea> ProductAreas { get; set; }
    public DbSet<SprintPerformance> SprintPerformances { get; set; }
    public DbSet<FeatureRelease> FeatureReleases { get; set; }
    public DbSet<QAPerformance> QAPerformances { get; set; }
    public DbSet<QADailyDelivery> QADailyDeliveries { get; set; }
    public DbSet<Iteration> Iterations { get; set; }
    public DbSet<ServiceNowTicket> ServiceNowTickets { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Team>().ToTable("Team");
        modelBuilder.Entity<Employee>().ToTable("Employee");
        modelBuilder.Entity<Sprint>().ToTable("Sprint");
        modelBuilder.Entity<ProductArea>().ToTable("ProductArea");
        modelBuilder.Entity<SprintPerformance>().ToTable("SprintPerformance");
        modelBuilder.Entity<FeatureRelease>().ToTable("FeatureRelease");
        modelBuilder.Entity<QAPerformance>().ToTable("QAPerformance");
        modelBuilder.Entity<QADailyDelivery>().ToTable("QADailyDelivery");
        modelBuilder.Entity<Iteration>().ToTable("Iteration");
        modelBuilder.Entity<ServiceNowTicket>().ToTable("ServiceNowTickets");

        modelBuilder.Entity<Iteration>()
            .HasOne(i => i.Sprint)
            .WithMany(s => s.Iterations)
            .HasForeignKey(i => i.SprintId)
            .OnDelete(DeleteBehavior.NoAction);

        modelBuilder.Entity<Iteration>()
            .HasOne(i => i.ProductArea)
            .WithMany(p => p.Iterations)
            .HasForeignKey(i => i.ProductAreaId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}

