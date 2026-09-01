namespace MSR.API.DTOs.SprintPerformance
{
    public class SprintPerformanceFilterDto
    {
        public int ProductAreaId { get; set; }

        public List<int> SprintNumbers { get; set; } = [];
    }
}