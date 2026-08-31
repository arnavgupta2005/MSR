using System.ComponentModel.DataAnnotations;

namespace MSR.API.Models
{
    public class Employee
    {
        [Key]
        public int EmployeeId { get; set; }

        public string EmployeeName { get; set; } = string.Empty;

        public int? TeamId { get; set; }

        // Relationship
        public Team? Team { get; set; }

        public ICollection<SprintPerformance> SprintPerformances { get; set; }
            = new List<SprintPerformance>();

        public ICollection<QAPerformance> QAPerformances { get; set; }
            = new List<QAPerformance>();
    }
}