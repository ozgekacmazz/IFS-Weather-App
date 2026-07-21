using IFSWeather.Application.Weather.External.Models;

namespace IFSWeather.Application.Weather.External.Interfaces;

public interface IExternalWeatherService
{
    Task<ExternalWeatherForecast> GetForecastAsync(
        ExternalForecastQuery query,
        CancellationToken cancellationToken = default);
}
