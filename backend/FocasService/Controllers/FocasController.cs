using Microsoft.AspNetCore.Mvc;
using FocasService.Models;
using FocasService.Services;
using WriteMacroRequest = FocasService.Models.WriteMacroRequest;

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

    [HttpPost("tool-offsets-range")]
    public IActionResult GetToolOffsetsRange([FromBody] ToolOffsetRangeRequest request)
    {
        var response = _focasService.GetToolOffsetsRange(request.StartToolNumber, request.EndToolNumber);
        // Return 200 with error details instead of 400, so Flask can see the error message
        return Ok(response);
    }

    [HttpGet("tool-offsets-range/{startToolNumber}/{endToolNumber}")]
    public IActionResult GetToolOffsetsRangeSimple(short startToolNumber, short endToolNumber)
    {
        var response = _focasService.GetToolOffsetsRange(startToolNumber, endToolNumber);
        // Return 200 with error details instead of 400, so Flask can see the error message
        return Ok(response);
    }

    [HttpPost("work-zero-offsets-range")]
    public IActionResult GetWorkZeroOffsetsRange([FromBody] WorkZeroOffsetRangeRequest request)
    {
        var response = _focasService.GetWorkZeroOffsetsRange(request.StartCoordinateSystem, request.EndCoordinateSystem);
        // Return 200 with error details instead of 400, so Flask can see the error message
        return Ok(response);
    }

    [HttpGet("work-zero-offsets-range/{startCoordinateSystem}/{endCoordinateSystem}")]
    public IActionResult GetWorkZeroOffsetsRangeSimple(short startCoordinateSystem, short endCoordinateSystem)
    {
        var response = _focasService.GetWorkZeroOffsetsRange(startCoordinateSystem, endCoordinateSystem);
        // Return 200 with error details instead of 400, so Flask can see the error message
        return Ok(response);
    }

    [HttpPost("work-zero-offset")]
    public IActionResult GetWorkZeroOffset([FromBody] WorkZeroOffsetSingleRequest request)
    {
        var response = _focasService.GetWorkZeroOffset(request.Number, request.Axis, request.Length);
        // Return 200 with error details instead of 400, so Flask can see the error message
        return Ok(response);
    }

    [HttpGet("work-zero-offset/{number}/{axis}/{length}")]
    public IActionResult GetWorkZeroOffsetSimple(short number, short axis, short length)
    {
        var response = _focasService.GetWorkZeroOffset(number, axis, length);
        // Return 200 with error details instead of 400, so Flask can see the error message
        return Ok(response);
    }

    [HttpPost("work-zero-offsets-range-single")]
    public IActionResult GetWorkZeroOffsetsRangeSingle([FromBody] WorkZeroOffsetRangeSingleRequest request)
    {
        var response = _focasService.GetWorkZeroOffsetsRangeSingle(
            request.Axis, 
            request.StartNumber, 
            request.EndNumber, 
            request.Length
        );
        // Return 200 with error details instead of 400, so Flask can see the error message
        return Ok(response);
    }

    [HttpGet("work-zero-offsets-range-single/{axis}/{startNumber}/{endNumber}")]
    public IActionResult GetWorkZeroOffsetsRangeSingleSimple(short axis, short startNumber, short endNumber)
    {
        var response = _focasService.GetWorkZeroOffsetsRangeSingle(axis, startNumber, endNumber, null);
        // Return 200 with error details instead of 400, so Flask can see the error message
        return Ok(response);
    }

    [HttpPost("write-macro")]
    public IActionResult WriteMacro([FromBody] WriteMacroRequest request)
    {
        var response = _focasService.WriteMacro(request.Number, request.McrVal, request.DecVal);
        // Return 200 with error details instead of 400, so Flask can see the error message
        return Ok(response);
    }
}

