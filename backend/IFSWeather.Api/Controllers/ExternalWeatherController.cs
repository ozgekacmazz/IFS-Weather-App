using IFSWeather.Application.Weather.External.Interfaces;
using IFSWeather.Application.Weather.External.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IFSWeather.Api.Controllers;

[ApiController]
[Route("api/weather/external")]
[Authorize]
public sealed class ExternalWeatherController : ControllerBase
{
    private readonly IExternalWeatherService _externalWeatherService;
    private readonly IExternalLocationSearchService _externalLocationSearchService;

    public ExternalWeatherController(
        IExternalWeatherService externalWeatherService,
        IExternalLocationSearchService externalLocationSearchService)
    {
        _externalWeatherService = externalWeatherService;
        _externalLocationSearchService = externalLocationSearchService;
    }

    [HttpGet("locations")]
    [ProducesResponseType<IReadOnlyList<ExternalLocation>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<IReadOnlyList<ExternalLocation>>> SearchLocations(
        [FromQuery] ExternalLocationQuery query,
        CancellationToken cancellationToken)
    {
        var response = await _externalLocationSearchService.SearchAsync(
            query,
            cancellationToken);

        return Ok(response);
    }

    [HttpGet("forecast")]
    [ProducesResponseType<ExternalWeatherForecast>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<ExternalWeatherForecast>> GetForecast(
        [FromQuery] ExternalForecastQuery query,
        CancellationToken cancellationToken)
    {
        var response = await _externalWeatherService.GetForecastAsync(
            query,
            cancellationToken);

        return Ok(response);
    }
}
