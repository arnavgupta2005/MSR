using System.ComponentModel.DataAnnotations;

namespace MSR.API.Models
{
    public class QAUserStory
    {
        [Key]
        public int QAUserStoryId { get; set; }

        public int SprintId { get; set; }

        public int ProductAreaId { get; set; }

        public int WorkItemId { get; set; }

        [Required]
        [MaxLength(50)]
        public string WorkItemType { get; set; } = string.Empty;

        // Navigation properties
        public Sprint? Sprint { get; set; }

        public ProductArea? ProductArea { get; set; }
    }
}