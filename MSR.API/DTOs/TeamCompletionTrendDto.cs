namespace MSR.API.DTOs.SprintPerformance
{
    public class TeamCompletionTrendDto
    {
        public int TeamId { get; set; }

        public string TeamName { get; set; } = string.Empty;

        public int SprintId { get; set; }

        public int SprintNumber { get; set; }

        public int AssignedPoints { get; set; }

        public int DeliveredPoints { get; set; }

        public double CompletionPercentage { get; set; }
    }
}