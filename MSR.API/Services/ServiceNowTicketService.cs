using Microsoft.EntityFrameworkCore;
using MSR.API.Data;
using MSR.API.DTOs.ServiceNow;

namespace MSR.API.Services
{
    public class ServiceNowTicketService : IServiceNowTicketService
    {
        private readonly MSRDbContext _context;

        public ServiceNowTicketService(MSRDbContext context)
        {
            _context = context;
        }

        public async Task<List<ServiceNowTicketDto>> GetAllAsync()
        {
            return await _context.ServiceNowTickets
                .AsNoTracking()
                .OrderBy(x => x.Sprint)
                .Select(x => new ServiceNowTicketDto
                {
                    Sprint = x.Sprint,
                    CriticalWeb = x.CriticalWeb,
                    Web = x.Web,
                    CriticalMobile = x.CriticalMobile,
                    Mobile = x.Mobile,
                    CompletionPercentage = x.CompletionPercentage
                })
                .ToListAsync();
        }

        public async Task<List<int>> GetSprintsAsync()
        {
            return await _context.ServiceNowTickets
                .AsNoTracking()
                .Select(x => x.Sprint)
                .Distinct()
                .OrderBy(x => x)
                .ToListAsync();
        }

        public async Task<List<ServiceNowTicketDto>> GetBySprintsAsync(
            ServiceNowTicketFilterDto filter)
        {
            var query = _context.ServiceNowTickets
                .AsNoTracking()
                .AsQueryable();

            // Sprint filtering comes directly from ServiceNowTickets.Sprint.
            if (filter.Sprints != null && filter.Sprints.Count > 0)
            {
                query = query.Where(x => filter.Sprints.Contains(x.Sprint));
            }

            return await query
                .OrderBy(x => x.Sprint)
                .Select(x => new ServiceNowTicketDto
                {
                    Sprint = x.Sprint,
                    CriticalWeb = x.CriticalWeb,
                    Web = x.Web,
                    CriticalMobile = x.CriticalMobile,
                    Mobile = x.Mobile,
                    CompletionPercentage = x.CompletionPercentage
                })
                .ToListAsync();
        }
    }
}
