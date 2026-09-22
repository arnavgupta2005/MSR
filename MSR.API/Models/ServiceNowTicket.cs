using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MSR.API.Models
{
    public class ServiceNowTicket
    {
        [Key]
        public int ServiceNowTicketId { get; set; }

        public int Sprint { get; set; }

        public int CriticalWeb { get; set; }

        public int Web { get; set; }

        public int CriticalMobile { get; set; }

        public int Mobile { get; set; }

        [Column(TypeName = "decimal(5,2)")]
        public decimal CompletionPercentage { get; set; }
    }
}
