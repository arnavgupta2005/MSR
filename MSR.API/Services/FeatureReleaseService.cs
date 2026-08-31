using Microsoft.EntityFrameworkCore;
using MSR.API.Data;
using MSR.API.DTOs.FeatureRelease;

namespace MSR.API.Services
{
    public class FeatureReleaseService : IFeatureReleaseService
    {
        private readonly MSRDbContext _context;

        public FeatureReleaseService(MSRDbContext context)
        {
            _context = context;
        }

        public async Task<List<FeatureReleaseDto>> GetFeatureReleases(
            string productName)
        {
            return await _context.FeatureReleases
                .Where(x => x.ProductName == productName)
                .OrderBy(x => x.PlannedSprint)
                .ThenBy(x => x.FeatureReleaseId)
                .Select(x => new FeatureReleaseDto
                {
                    FeatureDescription = x.FeatureDescription ?? string.Empty,
                    PlannedSprint = x.PlannedSprint,
                    ReleasedSprint = x.ReleasedSprint,
                    DelayReason = x.DelayReason
                })
                .ToListAsync();
        }
    }
}