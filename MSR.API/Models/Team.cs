using System.ComponentModel.DataAnnotations;

namespace MSR.API.Models
{
    public class Team
    {
        [Key]
        public int TeamId { get; set; }

        public string TeamName { get; set; } = string.Empty;

        // Relationship: Team 1 → many Employees
        public ICollection<Employee> Employees { get; set; }
            = new List<Employee>();
    }
}