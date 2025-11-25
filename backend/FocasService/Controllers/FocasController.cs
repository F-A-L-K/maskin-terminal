using Microsoft.AspNetCore.Mvc;
using FocasService.Models;
using FocasService.Services;

namespace FocasService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class FocasController : ControllerBase
{
    private readonly Services.FocasService _focasService;
    private readonly ILogger<FocasController> _logger;

    public FocasController(Services.FocasService focasService, ILogger<FocasController> logger)
    {
        _focasService = focasService;
        _logger = logger;
    }

    [HttpPost("connect")]
    public IActionResult Connect([FromBody] ConnectionRequest? request)
    {
        var response = _focasService.Connect(request?.IpAddress, request?.Port ?? 8193);
        return response.Success ? Ok(response) : BadRequest(response);
    }

    [HttpPost("disconnect")]
    public IActionResult Disconnect()
    {
        var response = _focasService.Disconnect();
        return response.Success ? Ok(response) : BadRequest(response);
    }

    [HttpGet("feedrate")]
    public IActionResult GetFeedrate()
    {
        var response = _focasService.GetFeedrate();
        return response.Success ? Ok(response) : BadRequest(response);
    }

    [HttpGet("spindle-speed")]
    public IActionResult GetSpindleSpeed()
    {
        var response = _focasService.GetSpindleSpeed();
        return response.Success ? Ok(response) : BadRequest(response);
    }

    [HttpGet("absolute-position")]
    public IActionResult GetAbsolutePosition()
    {
        var response = _focasService.GetAbsolutePosition();
        return response.Success ? Ok(response) : BadRequest(response);
    }

    [HttpGet("status")]
    public IActionResult GetStatus()
    {
        // Simple status endpoint
        return Ok(new { status = "FOCAS Service is running" });
    }

    [HttpPost("tool-radius")]
    public IActionResult GetToolRadius([FromBody] ToolRadiusRequest request)
    {
        var response = _focasService.GetToolRadius(request.ToolGroup, request.ToolNumber);
        if (response.Success)
        {
            return Ok(response);
        }
        else
        {
            // Return 200 with error details instead of 400, so Flask can see the error message
            return Ok(response);
        }
    }

    [HttpGet("tool-radius/{toolNumber}")]
    public IActionResult GetToolRadiusSimple(short toolNumber)
    {
        var response = _focasService.GetToolRadius(0, toolNumber); // 0 = aktuell grupp
        if (response.Success)
        {
            return Ok(response);
        }
        else
        {
            // Return 200 with error details instead of 400, so Flask can see the error message
            return Ok(response);
        }
    }

    [HttpPost("tool-offsets")]
    public IActionResult GetToolOffsets([FromBody] ToolOffsetRequest request)
    {
        var response = _focasService.GetToolOffsets(request.ToolNumber);
        // Return 200 with error details instead of 400, so Flask can see the error message
        return Ok(response);
    }

    [HttpGet("tool-offsets/{toolNumber}")]
    public IActionResult GetToolOffsetsSimple(short toolNumber)
    {
        var response = _focasService.GetToolOffsets(toolNumber);
        // Return 200 with error details instead of 400, so Flask can see the error message
        return Ok(response);
    }
}

