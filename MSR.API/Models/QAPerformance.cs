using System.ComponentModel.DataAnnotations;

namespace MSR.API.Models
{
    public class QAPerformance
    {
        [Key]
        public int QAPerformanceId { get; set; }

        public int SprintId { get; set; }

        public int EmployeeId { get; set; }

        public int ProductAreaId { get; set; }

        public int? QAWorkingDays { get; set; }

        public int? QACapacity { get; set; }

        public int? AssignedPoints { get; set; }

        public int? QADeliveredPoints { get; set; }

        public int? Rollover { get; set; }

        public int? QARolloverPoints { get; set; }

        public int? AverageVelocity { get; set; }

        public int? QAIterations { get; set; }

        public int? QAObservations { get; set; }

        // Navigation properties
        public Sprint? Sprint { get; set; }

        public Employee? Employee { get; set; }

        public ProductArea? ProductArea { get; set; }
    }
}