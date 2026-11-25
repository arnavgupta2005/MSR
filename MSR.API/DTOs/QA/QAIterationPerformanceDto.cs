namespace MSR.API.DTOs.QA
{
    public class QAIterationPerformanceDto
    {
        public int SprintId { get; set; }
        public int SprintNumber { get; set; }
        public int Iteration0 { get; set; }
        public int Iteration1 { get; set; }
        public int Iteration2 { get; set; }
        public int Others { get; set; }
    }
}
