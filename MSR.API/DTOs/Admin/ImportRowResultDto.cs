namespace MSR.API.DTOs.Admin
{
    // Status of a single parsed Excel row after validation.
    public enum ImportRowStatus
    {
        New,
        Duplicate,
        Invalid
    }

    // Result of validating one Excel row, returned to the UI preview.
    public class ImportRowResultDto
    {
        public int RowNumber { get; set; }

        public ImportRowStatus Status { get; set; }

        // Human-readable identity fields shown in the preview table.
        public string? Sprint { get; set; }
        public string? Team { get; set; }
        public string? Employee { get; set; }
        public string? Product { get; set; }

        // QA import identity fields (only populated for the relevant import type).
        public string? Day { get; set; }
        public string? Delivery { get; set; }
        public string? WorkItemId { get; set; }
        public string? WorkItemType { get; set; }

        // Feature Release identity fields (only populated for that import type).
        public string? FeatureDescription { get; set; }
        public string? PlannedSprint { get; set; }
        public string? ReleasedSprint { get; set; }

        // ServiceNow ticket identity fields (only populated for that import type).
        public string? CriticalWeb { get; set; }
        public string? Web { get; set; }
        public string? CriticalMobile { get; set; }
        public string? Mobile { get; set; }
        public string? CompletionPercentage { get; set; }

        public List<string> Errors { get; set; } = new();
    }
}
