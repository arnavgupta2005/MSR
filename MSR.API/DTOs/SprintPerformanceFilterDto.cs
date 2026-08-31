namespace MSR.API.DTOs.SprintPerformance
{
    public class SprintPerformanceFilterDto
    {
        public int ProductAreaId { get; set; }

        public int StartSprintNumber { get; set; }

        public int EndSprintNumber { get; set; }
    }
}