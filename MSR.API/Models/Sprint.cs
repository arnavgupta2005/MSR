using System.ComponentModel.DataAnnotations;

namespace MSR.API.Models
{
    public class Sprint
    {
        [Key]
        public int SprintId { get; set; }

        public int SprintNumber { get; set; }

        public ICollection<SprintPerformance> SprintPerformances { get; set; }
            = new List<SprintPerformance>();

        public ICollection<QAPerformance> QAPerformances { get; set; }
            = new List<QAPerformance>();

        public ICollection<QADailyDelivery> QADailyDeliveries { get; set; }
            = new List<QADailyDelivery>();

        public ICollection<QAUserStory> QAUserStories { get; set; }
            = new List<QAUserStory>();
    }
}