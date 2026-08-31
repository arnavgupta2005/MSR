using Microsoft.AspNetCore.Mvc;
using MSR.API.DTOs.FeatureRelease;
using MSR.API.Services;

namespace MSR.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class FeatureReleaseController : ControllerBase
    {
        private readonly IFeatureReleaseService _featureReleaseService;

        public FeatureReleaseController(
            IFeatureReleaseService featureReleaseService)
        {
            _featureReleaseService = featureReleaseService;
        }

        [HttpGet]
        public async Task<ActionResult<List<FeatureReleaseDto>>> GetFeatureReleases(
            [FromQuery] string productName)
        {
            var result = await _featureReleaseService
                .GetFeatureReleases(productName);

            return Ok(result);
        }
    }
}