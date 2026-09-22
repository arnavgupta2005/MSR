namespace MSR.API.DTOs.ServiceNow
{
    public class ServiceNowTicketDto
    {
        public int Sprint { get; set; }
        public int CriticalWeb { get; set; }
        public int Web { get; set; }
        public int CriticalMobile { get; set; }
        public int Mobile { get; set; }
        public decimal CompletionPercentage { get; set; }
    }
}
