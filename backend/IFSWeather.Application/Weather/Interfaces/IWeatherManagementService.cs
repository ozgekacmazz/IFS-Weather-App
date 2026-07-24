using IFSWeather.Application.Common.Models;
using IFSWeather.Application.Weather.DTOs;
using IFSWeather.Application.Weather.Models;

namespace IFSWeather.Application.Weather.Interfaces;

public interface IWeatherManagementService
{
    Task<PaginatedResponse<WeatherResponse>> GetWeatherAsync(
        WeatherQuery query,
        CancellationToken cancellationToken = default);

    Task<WeatherResponse> GetWeatherByIdAsync(
        int weatherId,
        CancellationToken cancellationToken = default);

    Task<WeatherResponse> CreateWeatherAsync(
        CreateWeatherRequest request,
        CancellationToken cancellationToken = default);

    Task<WeatherResponse> UpdateWeatherAsync(
        int weatherId,
        UpdateWeatherRequest request,
        CancellationToken cancellationToken = default);

    Task DeleteWeatherAsync(
        int weatherId,
        CancellationToken cancellationToken = default);
}
