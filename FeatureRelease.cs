using System.ComponentModel.DataAnnotations;

namespace MSR.API.Models
{
    public class FeatureRelease
    {
        [Key]
        public int FeatureReleaseId { get; set; }

        public string? ProductName { get; set; }

        public int? PlannedSprint { get; set; }

        public int? ReleasedSprint { get; set; }

        public string? FeatureDescription { get; set; }

        public string? DelayReason { get; set; }
    }
}