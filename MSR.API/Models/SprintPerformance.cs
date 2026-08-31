using System.ComponentModel.DataAnnotations;

namespace MSR.API.Models
{
    public class SprintPerformance
    {
        [Key]
        public int SprintPerformanceId { get; set; }

        public int SprintId { get; set; }

        public int TeamId { get; set; }

        public int EmployeeId { get; set; }

        public int ProductAreaId { get; set; }

        public int? WorkingDays { get; set; }
        public int? Holidays { get; set; }
        public int? Leaves { get; set; }
        public int? SprintDays { get; set; }

        public int? Capacity { get; set; }
        public int? AssignedPoints { get; set; }
        public int? DeliveredPoints { get; set; }

        public int? PlannedItems { get; set; }
        public int? DeliveredItems { get; set; }
        public int? UserStories { get; set; }
        public int? Bugs { get; set; }

        public int? Rollover { get; set; }
        public int? RolloverPoints { get; set; }

        public int? IdealStoryPoints { get; set; }
        public int? Velocity { get; set; }
        public int? ActualVelocity { get; set; }
        public int? TrailingVelocity { get; set; }

        // Navigation properties
        public Sprint? Sprint { get; set; }

        public Team? Team { get; set; }

        public Employee? Employee { get; set; }

        public ProductArea? ProductArea { get; set; }
    }
}