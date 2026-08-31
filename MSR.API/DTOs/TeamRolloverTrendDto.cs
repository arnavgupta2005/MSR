namespace MSR.API.DTOs.SprintPerformance
{
    public class TeamRolloverTrendDto
    {
        public int TeamId { get; set; }

        public string TeamName { get; set; } = string.Empty;

        public int SprintId { get; set; }

        public int SprintNumber { get; set; }

        public int Rollover { get; set; }

        public int RolloverPoints { get; set; }
    }
}