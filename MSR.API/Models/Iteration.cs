using System.ComponentModel.DataAnnotations;

namespace MSR.API.Models
{
    public class Iteration
    {
        [Key]
        public int IterationId { get; set; }

        public int SprintId { get; set; }

        public int? Iteration0 { get; set; }

        public int? Iteration1 { get; set; }

        public int? Iteration2 { get; set; }

        public int? Others { get; set; }

        public int ProductAreaId { get; set; }

        public Sprint? Sprint { get; set; }

        public ProductArea? ProductArea { get; set; }
    }
}
