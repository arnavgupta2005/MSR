namespace MSR.API.DTOs.SprintPerformance
{
    public class VelocityTrendDto
    {
        public int SprintId { get; set; }

        public int SprintNumber { get; set; }

        public int ActualVelocity { get; set; }

        public int TrailingVelocity { get; set; }
    }
}