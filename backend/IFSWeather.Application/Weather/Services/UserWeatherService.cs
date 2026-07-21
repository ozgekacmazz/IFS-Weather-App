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
    private readonly IValidator<CurrentWeatherQuery> _currentWeatherValidator;
    private readonly IValidator<WeatherForecastQuery> _forecastValidator;

    public UserWeatherService(
        ICurrentUserService currentUserService,
        IUserRepository userRepository,
        IWeatherRepository weatherRepository,
        IValidator<CurrentWeatherQuery> currentWeatherValidator,
        IValidator<WeatherForecastQuery> forecastValidator)
    {
        _currentUserService = currentUserService;
        _userRepository = userRepository;
        _weatherRepository = weatherRepository;
        _currentWeatherValidator = currentWeatherValidator;
        _forecastValidator = forecastValidator;
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
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var weatherInfo = await _weatherRepository.GetByCityAndDateAsync(
                city,
                today,
                cancellationToken)
            ?? throw new WeatherNotFoundException();

        return MapResponse(weatherInfo);
    }

    public async Task<WeatherForecastResponse> GetForecastAsync(
        WeatherForecastQuery query,
        CancellationToken cancellationToken = default)
    {
        var normalizedQuery = query with
        {
            City = NormalizeOptionalCity(query.City)
        };

        await _forecastValidator.ValidateAndThrowAsync(
            normalizedQuery,
            cancellationToken);

        var city = await ResolveCityAsync(normalizedQuery.City, cancellationToken);
        var startDate = DateOnly.FromDateTime(DateTime.UtcNow);
        var endDate = startDate.AddDays(normalizedQuery.Days - 1);
        var weatherInfos = await _weatherRepository.GetByCityAndDateRangeAsync(
            city,
            startDate,
            endDate,
            cancellationToken);
        var items = weatherInfos.Select(MapResponse).ToArray();

        return new WeatherForecastResponse(
            city,
            startDate,
            normalizedQuery.Days,
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

    private static CurrentWeatherResponse MapResponse(WeatherInfo weatherInfo)
    {
        return new CurrentWeatherResponse(
            weatherInfo.Id,
            weatherInfo.WeatherDate,
            weatherInfo.CityName,
            weatherInfo.Temperature,
            weatherInfo.MainStatus,
            weatherInfo.UpdatedAt);
    }

    private static string? NormalizeOptionalCity(string? city)
    {
        var normalized = RepeatedWhitespace.Replace(city?.Trim() ?? string.Empty, " ");
        return normalized.Length == 0 ? null : normalized;
    }
}
