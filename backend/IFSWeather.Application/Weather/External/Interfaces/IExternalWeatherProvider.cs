using IFSWeather.Application.Weather.External.Models;

namespace IFSWeather.Application.Weather.External.Interfaces;

public interface IExternalWeatherProvider
{
    Task<IReadOnlyList<ExternalLocation>> SearchLocationsAsync(
        string query,
        CancellationToken cancellationToken = default);

    Task<ExternalWeatherForecast> GetForecastAsync(
        string city,
        int days,
        CancellationToken cancellationToken = default);
}
