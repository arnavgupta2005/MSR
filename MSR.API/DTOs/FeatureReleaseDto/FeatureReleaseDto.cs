namespace MSR.API.DTOs.FeatureRelease
{
    public class FeatureReleaseDto
    {
        public string FeatureDescription { get; set; } = string.Empty;

        public int? PlannedSprint { get; set; }

        public int? ReleasedSprint { get; set; }

        public string? DelayReason { get; set; }
    }
}