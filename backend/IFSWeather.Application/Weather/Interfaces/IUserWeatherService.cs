using IFSWeather.Application.Weather.DTOs;
using IFSWeather.Application.Weather.Models;

namespace IFSWeather.Application.Weather.Interfaces;

public interface IUserWeatherService
{
    Task<CurrentWeatherResponse> GetCurrentWeatherAsync(
        CurrentWeatherQuery query,
        CancellationToken cancellationToken = default);

    Task<WeatherForecastResponse> GetForecastAsync(
        WeatherForecastQuery query,
        CancellationToken cancellationToken = default);
}
