using IFSWeather.Application.Common.Models;
using IFSWeather.Application.Weather.DTOs;
using IFSWeather.Application.Weather.Interfaces;
using IFSWeather.Application.Weather.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IFSWeather.Api.Controllers;

[ApiController]
[Route("api/admin/weather")]
[Authorize(Roles = "Admin")]
public sealed class AdminWeatherController : ControllerBase
{
    private readonly IWeatherManagementService _weatherManagementService;
    private readonly IAdminLiveWeatherService _adminLiveWeatherService;

    public AdminWeatherController(
        IWeatherManagementService weatherManagementService,
        IAdminLiveWeatherService adminLiveWeatherService)
    {
        _weatherManagementService = weatherManagementService;
        _adminLiveWeatherService = adminLiveWeatherService;
    }

    [HttpPost("live/preview")]
    [ProducesResponseType<AdminWeatherPreviewResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<AdminWeatherPreviewResponse>> PreviewLiveWeather(
        [FromBody] AdminWeatherPreviewRequest request,
        CancellationToken cancellationToken)
    {
        return Ok(await _adminLiveWeatherService.PreviewAsync(
            request,
            cancellationToken));
    }

    [HttpPost("live/save")]
    [ProducesResponseType<SaveWeatherPreviewResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<SaveWeatherPreviewResponse>> SaveLiveWeather(
        [FromBody] SaveWeatherPreviewRequest request,
        CancellationToken cancellationToken)
    {
        return Ok(await _adminLiveWeatherService.SaveAsync(
            request,
            cancellationToken));
    }

    [HttpGet]
    [ProducesResponseType<PaginatedResponse<WeatherResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<PaginatedResponse<WeatherResponse>>> GetWeather(
        [FromQuery] WeatherQuery query,
        CancellationToken cancellationToken)
    {
        var response = await _weatherManagementService.GetWeatherAsync(
            query,
            cancellationToken);

        return Ok(response);
    }

    [HttpGet("{weatherId:int}")]
    [ProducesResponseType<WeatherResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<WeatherResponse>> GetWeatherById(
        int weatherId,
        CancellationToken cancellationToken)
    {
        var response = await _weatherManagementService.GetWeatherByIdAsync(
            weatherId,
            cancellationToken);

        return Ok(response);
    }

    [HttpPost]
    [ProducesResponseType<WeatherResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<WeatherResponse>> CreateWeather(
        [FromBody] CreateWeatherRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _weatherManagementService.CreateWeatherAsync(
            request,
            cancellationToken);

        return CreatedAtAction(
            nameof(GetWeatherById),
            new { weatherId = response.WeatherId },
            response);
    }

    [HttpDelete("{weatherId:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteWeather(
        int weatherId,
        CancellationToken cancellationToken)
    {
        await _weatherManagementService.DeleteWeatherAsync(
            weatherId,
            cancellationToken);

        return NoContent();
    }
}
