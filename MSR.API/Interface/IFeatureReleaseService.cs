using MSR.API.DTOs.FeatureRelease;

namespace MSR.API.Services
{
    public interface IFeatureReleaseService
    {
        Task<List<FeatureReleaseDto>> GetFeatureReleases(string productName);
    }
}