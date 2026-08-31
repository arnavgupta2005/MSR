namespace MSR.API.DTOs.SprintPerformance
{
    public class SprintKpiFilterDto
    {

        public int ProductAreaId { get; set; }
        public List<int> SprintIds { get; set; } = [];


    }
}