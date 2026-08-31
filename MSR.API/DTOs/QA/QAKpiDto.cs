namespace MSR.API.DTOs.QA
{
    public class QAKpiDto
    {
        
        public int TotalStories { get; set; }

        public int Capacity { get; set; }

        public int TotalStoryPoints { get; set; }

        public int Rollovers { get; set; }

        public int RolloverPoints { get; set; }

        public int Observations { get; set; }
    }
}