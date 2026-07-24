using System.Text.RegularExpressions;
using FluentValidation;
using IFSWeather.Application.Authentication.Interfaces;
using IFSWeather.Application.Common.Interfaces;
using IFSWeather.Application.Profile.Exceptions;
using IFSWeather.Application.Weather.DTOs;
using IFSWeather.Application.Weather.Exceptions;
using IFSWeather.Application.Weather.Interfaces;
using IFSWeather.Application.Weather.Models;
using IFSWeather.Domain.Entities;

namespace IFSWeather.Application.Weather.Services;

public sealed class UserWeatherService : IUserWeatherService
{
    private static readonly Regex RepeatedWhitespace = new(
        @"\s+",
        RegexOptions.Compiled);

    private readonly ICurrentUserService _currentUserService;
    private readonly IUserRepository _userRepository;
    private readonly IWeatherRepository _weatherRepository;
    private readonly IWeatherRecommendationService _weatherRecommendationService;
    private readonly IValidator<CurrentWeatherQuery> _currentWeatherValidator;
    private readonly TimeProvider _timeProvider;

    public UserWeatherService(
        ICurrentUserService currentUserService,
        IUserRepository userRepository,
        IWeatherRepository weatherRepository,
        IWeatherRecommendationService weatherRecommendationService,
        IValidator<CurrentWeatherQuery> currentWeatherValidator,
        TimeProvider timeProvider)
    {
        _currentUserService = currentUserService;
        _userRepository = userRepository;
        _weatherRepository = weatherRepository;
        _weatherRecommendationService = weatherRecommendationService;
        _currentWeatherValidator = currentWeatherValidator;
        _timeProvider = timeProvider;
    }

    public async Task<CurrentWeatherResponse> GetCurrentWeatherAsync(
        CurrentWeatherQuery query,
        CancellationToken cancellationToken = default)
    {
        var normalizedQuery = query with
        {
            City = NormalizeOptionalCity(query.City)
        };

        await _currentWeatherValidator.ValidateAndThrowAsync(
            normalizedQuery,
            cancellationToken);

        var city = await ResolveCityAsync(normalizedQuery.City, cancellationToken);
        var today = DateOnly.FromDateTime(
            _timeProvider.GetUtcNow().UtcDateTime);
        var weatherInfo = await _weatherRepository.GetByCityAndDateAsync(
                city,
                today,
                cancellationToken)
            ?? throw new WeatherNotFoundException();

        return MapTodayResponse(weatherInfo);
    }

    public async Task<WeatherForecastResponse> GetForecastAsync(
        CancellationToken cancellationToken = default)
    {
        var city = await ResolveCityAsync(null, cancellationToken);
        var currentDate = DateOnly.FromDateTime(
            _timeProvider.GetUtcNow().UtcDateTime);
        var daysSinceMonday = (
            7 + (int)currentDate.DayOfWeek - (int)DayOfWeek.Monday) % 7;
        var startDate = currentDate.AddDays(-daysSinceMonday);
        var endDate = startDate.AddDays(6);
        var weatherInfos = await _weatherRepository.GetByCityAndDateRangeAsync(
            city,
            startDate,
            endDate,
            cancellationToken);
        var items = weatherInfos.Select(MapForecastResponse).ToArray();

        return new WeatherForecastResponse(
            city,
            startDate,
            7,
            items);
    }

    private async Task<string> ResolveCityAsync(
        string? requestedCity,
        CancellationToken cancellationToken)
    {
        if (requestedCity is not null)
        {
            return requestedCity;
        }

        if (!_currentUserService.IsAuthenticated
            || _currentUserService.UserId is not int userId)
        {
            throw new ProfileUnavailableException();
        }

        var user = await _userRepository.GetByIdAsync(userId, cancellationToken)
            ?? throw new ProfileUnavailableException();
        var defaultCity = NormalizeOptionalCity(user.DefaultCity);

        return defaultCity ?? throw new DefaultCityUnavailableException();
    }

    private CurrentWeatherResponse MapTodayResponse(WeatherInfo weatherInfo)
    {
        var recommendations = _weatherRecommendationService.GetRecommendations(
            new WeatherRecommendationContext(
                weatherInfo.Temperature,
                weatherInfo.MainStatus,
                weatherInfo.WeatherDate));

        return MapResponse(weatherInfo, recommendations);
    }

    private static CurrentWeatherResponse MapForecastResponse(
        WeatherInfo weatherInfo)
    {
        return MapResponse(
            weatherInfo,
            Array.Empty<WeatherRecommendationResponse>());
    }

    private static CurrentWeatherResponse MapResponse(
        WeatherInfo weatherInfo,
        IReadOnlyList<WeatherRecommendationResponse> recommendations)
    {
        return new CurrentWeatherResponse(
            weatherInfo.Id,
            weatherInfo.WeatherDate,
            weatherInfo.CityName,
            weatherInfo.Temperature,
            weatherInfo.MinimumTemperature,
            weatherInfo.MaximumTemperature,
            weatherInfo.AverageHumidity,
            weatherInfo.MaximumWindSpeedKph,
            weatherInfo.PrecipitationProbability,
            weatherInfo.MainStatus,
            weatherInfo.UpdatedAt,
            recommendations);
    }

    private static string? NormalizeOptionalCity(string? city)
    {
        var normalized = RepeatedWhitespace.Replace(city?.Trim() ?? string.Empty, " ");
        return normalized.Length == 0 ? null : normalized;
    }
}
