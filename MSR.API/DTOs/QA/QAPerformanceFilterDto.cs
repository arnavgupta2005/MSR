namespace MSR.API.DTOs.QA
{
    public class QAPerformanceFilterDto
    {
        public int ProductAreaId { get; set; }

        public List<int> SprintNumbers { get; set; } = [];
    }
}