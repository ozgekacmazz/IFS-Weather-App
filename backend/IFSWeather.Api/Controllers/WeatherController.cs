using IFSWeather.Application.Weather.DTOs;
using IFSWeather.Application.Weather.Interfaces;
using IFSWeather.Application.Weather.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IFSWeather.Api.Controllers;

[ApiController]
[Route("api/weather")]
[Authorize]
public sealed class WeatherController : ControllerBase
{
    private readonly IUserWeatherService _userWeatherService;

    public WeatherController(IUserWeatherService userWeatherService)
    {
        _userWeatherService = userWeatherService;
    }

    [HttpGet("today")]
    [ProducesResponseType<CurrentWeatherResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CurrentWeatherResponse>> GetCurrentWeather(
        [FromQuery] CurrentWeatherQuery query,
        CancellationToken cancellationToken)
    {
        var response = await _userWeatherService.GetCurrentWeatherAsync(
            query,
            cancellationToken);

        return Ok(response);
    }

    [HttpGet("forecast")]
    [ProducesResponseType<WeatherForecastResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<WeatherForecastResponse>> GetForecast(
        CancellationToken cancellationToken)
    {
        var response = await _userWeatherService.GetForecastAsync(
            cancellationToken);

        return Ok(response);
    }
}
