using System.ComponentModel.DataAnnotations;

namespace MSR.API.Models
{
    public class QADailyDelivery
    {
        [Key]
        public int QADailyDeliveryId { get; set; }

        public int SprintId { get; set; }

        public int ProductAreaId { get; set; }

        public int Day { get; set; }

        public int? Delivery { get; set; }

        // Navigation properties
        public Sprint? Sprint { get; set; }

        public ProductArea? ProductArea { get; set; }
    }
}