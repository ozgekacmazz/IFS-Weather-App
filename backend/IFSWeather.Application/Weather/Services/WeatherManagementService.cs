using System.Text.RegularExpressions;
using FluentValidation;
using IFSWeather.Application.Common.Models;
using IFSWeather.Application.Weather.DTOs;
using IFSWeather.Application.Weather.Exceptions;
using IFSWeather.Application.Weather.Interfaces;
using IFSWeather.Application.Weather.Models;
using IFSWeather.Domain.Entities;

namespace IFSWeather.Application.Weather.Services;

public sealed class WeatherManagementService : IWeatherManagementService
{
    private static readonly Regex RepeatedWhitespace = new(
        @"\s+",
        RegexOptions.Compiled);

    private readonly IWeatherRepository _weatherRepository;
    private readonly IValidator<CreateWeatherRequest> _createValidator;
    private readonly IValidator<WeatherQuery> _queryValidator;

    public WeatherManagementService(
        IWeatherRepository weatherRepository,
        IValidator<CreateWeatherRequest> createValidator,
        IValidator<WeatherQuery> queryValidator)
    {
        _weatherRepository = weatherRepository;
        _createValidator = createValidator;
        _queryValidator = queryValidator;
    }

    public async Task<PaginatedResponse<WeatherResponse>> GetWeatherAsync(
        WeatherQuery query,
        CancellationToken cancellationToken = default)
    {
        var normalizedQuery = query with
        {
            City = NormalizeOptionalText(query.City)
        };

        await _queryValidator.ValidateAndThrowAsync(normalizedQuery, cancellationToken);

        var (items, totalCount) = await _weatherRepository.GetPagedAsync(
            normalizedQuery.PageNumber,
            normalizedQuery.PageSize,
            normalizedQuery.City,
            normalizedQuery.Date,
            cancellationToken);
        var responses = items.Select(MapResponse).ToArray();
        var totalPages = (int)Math.Ceiling(
            totalCount / (double)normalizedQuery.PageSize);

        return new PaginatedResponse<WeatherResponse>(
            responses,
            normalizedQuery.PageNumber,
            normalizedQuery.PageSize,
            totalCount,
            totalPages);
    }

    public async Task<WeatherResponse> GetWeatherByIdAsync(
        int weatherId,
        CancellationToken cancellationToken = default)
    {
        var weatherInfo = await _weatherRepository.GetByIdAsync(
                weatherId,
                cancellationToken)
            ?? throw new WeatherNotFoundException();

        return MapResponse(weatherInfo);
    }

    public async Task<WeatherResponse> CreateWeatherAsync(
        CreateWeatherRequest request,
        CancellationToken cancellationToken = default)
    {
        var normalizedRequest = request with
        {
            CityName = NormalizeRequiredText(request.CityName),
            MainStatus = NormalizeRequiredText(request.MainStatus)
        };

        await _createValidator.ValidateAndThrowAsync(
            normalizedRequest,
            cancellationToken);

        if (await _weatherRepository.ExistsForCityAndDateAsync(
                normalizedRequest.CityName,
                normalizedRequest.WeatherDate,
                cancellationToken))
        {
            throw new WeatherConflictException();
        }

        var utcNow = DateTime.UtcNow;
        var weatherInfo = new WeatherInfo
        {
            WeatherDate = normalizedRequest.WeatherDate,
            CityName = normalizedRequest.CityName,
            Temperature = normalizedRequest.Temperature,
            MainStatus = normalizedRequest.MainStatus,
            CreatedAt = utcNow,
            UpdatedAt = utcNow
        };

        await _weatherRepository.AddAsync(weatherInfo, cancellationToken);
        await _weatherRepository.SaveChangesAsync(cancellationToken);

        return MapResponse(weatherInfo);
    }

    public async Task DeleteWeatherAsync(
        int weatherId,
        CancellationToken cancellationToken = default)
    {
        var weatherInfo = await _weatherRepository.GetTrackedByIdAsync(
                weatherId,
                cancellationToken)
            ?? throw new WeatherNotFoundException();

        _weatherRepository.Remove(weatherInfo);
        await _weatherRepository.SaveChangesAsync(cancellationToken);
    }

    private static WeatherResponse MapResponse(WeatherInfo weatherInfo)
    {
        return new WeatherResponse(
            weatherInfo.Id,
            weatherInfo.WeatherDate,
            weatherInfo.CityName,
            weatherInfo.Temperature,
            weatherInfo.MainStatus,
            weatherInfo.CreatedAt,
            weatherInfo.UpdatedAt);
    }

    private static string NormalizeRequiredText(string? value)
    {
        return RepeatedWhitespace.Replace(value?.Trim() ?? string.Empty, " ");
    }

    private static string? NormalizeOptionalText(string? value)
    {
        var normalized = NormalizeRequiredText(value);
        return normalized.Length == 0 ? null : normalized;
    }
}
