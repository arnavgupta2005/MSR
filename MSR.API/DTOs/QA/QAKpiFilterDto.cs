namespace MSR.API.DTOs.QA
{
    public class QAKpiFilterDto
    {
        public int ProductAreaId { get; set; }

        public List<int> SprintIds { get; set; } = [];
    }
}