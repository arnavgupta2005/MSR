using MSR.API.DTOs.ServiceNow;

namespace MSR.API.Services
{
    public interface IServiceNowTicketService
    {
        Task<List<ServiceNowTicketDto>> GetAllAsync();

        Task<List<int>> GetSprintsAsync();

        Task<List<ServiceNowTicketDto>> GetBySprintsAsync(
            ServiceNowTicketFilterDto filter);
    }
}
