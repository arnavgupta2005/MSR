namespace MSR.API.DTOs.SprintPerformance
{
    public class TeamVelocityTrendDto
    {
        public int TeamId { get; set; }

        public string TeamName { get; set; } = string.Empty;

        public int SprintId { get; set; }

        public int SprintNumber { get; set; }

        public int ActualVelocity { get; set; }

        public int Capacity { get; set; }

        public int TrailingVelocity { get; set; }
    }
}