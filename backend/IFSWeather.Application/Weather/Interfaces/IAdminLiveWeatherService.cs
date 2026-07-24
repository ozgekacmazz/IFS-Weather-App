using IFSWeather.Application.Weather.DTOs;

namespace IFSWeather.Application.Weather.Interfaces;

public interface IAdminLiveWeatherService
{
    Task<AdminWeatherPreviewResponse> PreviewAsync(
        AdminWeatherPreviewRequest request,
        CancellationToken cancellationToken = default);

    Task<SaveWeatherPreviewResponse> SaveAsync(
        SaveWeatherPreviewRequest request,
        CancellationToken cancellationToken = default);
}
