namespace MSR.API.DTOs.SprintPerformance
{
    public class ProductTrendDto
    {
        public int SprintId { get; set; }

        public int SprintNumber { get; set; }
        public int ProductAreaId { get; set; }

        public int Velocity { get; set; }

        public int AssignedPoints { get; set; }

        public int DeliveredPoints { get; set; }

        public int PlannedItems { get; set; }

        public int DeliveredItems { get; set; }

        public int Rollovers { get; set; }

        public int RolloverPoints { get; set; }
        public string? Dip3Rollovers { get; set; }
        public string? Dip4PlannedItemsDeliveredItems { get; set; }
        public string? Dip5AssignedDeliveredPointsVelocity { get; set; }
    }
}
