namespace MSR.API.DTOs.QA
{
    public class QAStoryPointsTestedDto
    {
        
        public int SprintId { get; set; }
        public int SprintNumber { get; set; }

        public int EmployeeId { get; set; }

        public string EmployeeName { get; set; } = string.Empty;

        public int DeliveredPoints { get; set; }
    }
}