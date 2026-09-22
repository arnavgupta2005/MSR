using Microsoft.AspNetCore.Mvc;
using MSR.API.DTOs.ServiceNow;
using MSR.API.Services;

namespace MSR.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ServiceNowTicketController : ControllerBase
    {
        private readonly IServiceNowTicketService _serviceNowTicketService;

        public ServiceNowTicketController(
            IServiceNowTicketService serviceNowTicketService)
        {
            _serviceNowTicketService = serviceNowTicketService;
        }

        [HttpGet]
        public async Task<ActionResult<List<ServiceNowTicketDto>>> GetAll()
        {
            var result = await _serviceNowTicketService.GetAllAsync();
            return Ok(result);
        }

        [HttpGet("sprints")]
        public async Task<ActionResult<List<int>>> GetSprints()
        {
            var result = await _serviceNowTicketService.GetSprintsAsync();
            return Ok(result);
        }

        [HttpGet("by-sprints")]
        public async Task<ActionResult<List<ServiceNowTicketDto>>> GetBySprints(
            [FromQuery] ServiceNowTicketFilterDto filter)
        {
            var result = await _serviceNowTicketService.GetBySprintsAsync(filter);
            return Ok(result);
        }
    }
}
