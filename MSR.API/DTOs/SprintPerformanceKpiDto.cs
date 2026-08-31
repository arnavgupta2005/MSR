namespace MSR.API.DTOs.SprintPerformance
{
    public class SprintPerformanceKpiDto
    {
        public int? Capacity { get; set; }

        public int? Velocity { get; set; }

        public int? AssignedPoints { get; set; }

        public int? DeliveredPoints { get; set; }

        public int? Rollovers { get; set; }

        public int? RolloverPoints { get; set; }

        public int? PlannedItems { get; set; }

        public int? DeliveredItems { get; set; }

        public double? CompletionPercentage { get; set; }
    }
}