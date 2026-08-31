using System.ComponentModel.DataAnnotations;

namespace MSR.API.Models
{
    public class ProductArea
    {
        [Key]
        public int ProductAreaId { get; set; }

        public string ProductAreaName { get; set; } = string.Empty;

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