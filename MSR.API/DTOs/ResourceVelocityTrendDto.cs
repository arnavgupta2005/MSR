namespace MSR.API.DTOs.SprintPerformance
{
    public class ResourceVelocityTrendDto
    {
        public int EmployeeId { get; set; }

        public string EmployeeName { get; set; } = string.Empty;

        public int TeamId { get; set; }

        public string TeamName { get; set; } = string.Empty;

        public int SprintId { get; set; }

        public int SprintNumber { get; set; }

        public int ActualVelocity { get; set; }

        public int AssignedPoints { get; set; }

        public int Capacity { get; set; }

        public int TrailingVelocity { get; set; }
    }
}