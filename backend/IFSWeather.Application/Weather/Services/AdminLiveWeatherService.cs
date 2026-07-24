using System.Text.RegularExpressions;
using FluentValidation;
using IFSWeather.Application.Weather.DTOs;
using IFSWeather.Application.Weather.External.Interfaces;
using IFSWeather.Application.Weather.External.Models;
using IFSWeather.Application.Weather.Interfaces;
using IFSWeather.Domain.Entities;

namespace IFSWeather.Application.Weather.Services;

public sealed class AdminLiveWeatherService : IAdminLiveWeatherService
{
    private static readonly Regex RepeatedWhitespace = new(
        @"\s+",
        RegexOptions.Compiled);

    private readonly IExternalWeatherService _externalWeatherService;
    private readonly IWeatherRepository _weatherRepository;
    private readonly IValidator<AdminWeatherPreviewRequest> _previewValidator;
    private readonly IValidator<SaveWeatherPreviewRequest> _saveValidator;
    private readonly TimeProvider _timeProvider;

    public AdminLiveWeatherService(
        IExternalWeatherService externalWeatherService,
        IWeatherRepository weatherRepository,
        IValidator<AdminWeatherPreviewRequest> previewValidator,
        IValidator<SaveWeatherPreviewRequest> saveValidator,
        TimeProvider timeProvider)
    {
        _externalWeatherService = externalWeatherService;
        _weatherRepository = weatherRepository;
        _previewValidator = previewValidator;
        _saveValidator = saveValidator;
        _timeProvider = timeProvider;
    }

    public async Task<AdminWeatherPreviewResponse> PreviewAsync(
        AdminWeatherPreviewRequest request,
        CancellationToken cancellationToken = default)
    {
        var normalized = request with
        {
            CityName = Normalize(request.CityName),
            DisplayLabel = Normalize(request.DisplayLabel)
        };
        await _previewValidator.ValidateAndThrowAsync(normalized, cancellationToken);

        var forecast = await _externalWeatherService.GetForecastByCoordinatesAsync(
            new ExternalCoordinateForecastQuery
            {
                Latitude = normalized.Latitude,
                Longitude = normalized.Longitude,
                Days = 1
            },
            cancellationToken);
        var current = forecast.Days[0];

        return new AdminWeatherPreviewResponse(
            normalized.Latitude,
            normalized.Longitude,
            normalized.CityName,
            normalized.DisplayLabel,
            current.Date,
            current.AverageTemperature,
            current.MainStatus);
    }

    public async Task<SaveWeatherPreviewResponse> SaveAsync(
        SaveWeatherPreviewRequest request,
        CancellationToken cancellationToken = default)
    {
        var normalized = request with
        {
            CityName = Normalize(request.CityName),
            DisplayLabel = Normalize(request.DisplayLabel),
            MainStatus = Normalize(request.MainStatus)
        };
        await _saveValidator.ValidateAndThrowAsync(normalized, cancellationToken);

        var now = _timeProvider.GetUtcNow().UtcDateTime;
        var (weather, inserted) = await _weatherRepository.UpsertAsync(
            new WeatherInfo
            {
                WeatherDate = normalized.WeatherDate,
                CityName = normalized.CityName,
                Temperature = normalized.Temperature,
                MainStatus = normalized.MainStatus,
                CreatedAt = now,
                UpdatedAt = now
            },
            cancellationToken);

        return new SaveWeatherPreviewResponse(
            inserted,
            new WeatherResponse(
                weather.Id,
                weather.WeatherDate,
                weather.CityName,
                weather.Temperature,
                weather.MainStatus,
                weather.CreatedAt,
                weather.UpdatedAt));
    }

    private static string Normalize(string? value) =>
        RepeatedWhitespace.Replace(value?.Trim() ?? string.Empty, " ");
}
