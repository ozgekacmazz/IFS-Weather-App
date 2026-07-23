using System.Text.RegularExpressions;
using FluentValidation;
using IFSWeather.Application.Weather.External.Interfaces;
using IFSWeather.Application.Weather.External.Models;

namespace IFSWeather.Application.Weather.External.Services;

public sealed class ExternalWeatherService : IExternalWeatherService
{
    private static readonly Regex RepeatedWhitespace = new(
        @"\s+",
        RegexOptions.Compiled);

    private readonly IExternalWeatherProvider _externalWeatherProvider;
    private readonly IValidator<ExternalForecastQuery> _validator;
    private readonly IValidator<ExternalCoordinateForecastQuery> _coordinateValidator;

    public ExternalWeatherService(
        IExternalWeatherProvider externalWeatherProvider,
        IValidator<ExternalForecastQuery> validator,
        IValidator<ExternalCoordinateForecastQuery> coordinateValidator)
    {
        _externalWeatherProvider = externalWeatherProvider;
        _validator = validator;
        _coordinateValidator = coordinateValidator;
    }

    public async Task<ExternalWeatherForecast> GetForecastByCoordinatesAsync(
        ExternalCoordinateForecastQuery query,
        CancellationToken cancellationToken = default)
    {
        await _coordinateValidator.ValidateAndThrowAsync(query, cancellationToken);

        return await _externalWeatherProvider.GetForecastByCoordinatesAsync(
            query.Latitude!.Value,
            query.Longitude!.Value,
            query.Days,
            cancellationToken);
    }

    public async Task<ExternalWeatherForecast> GetForecastAsync(
        ExternalForecastQuery query,
        CancellationToken cancellationToken = default)
    {
        var normalizedQuery = query with
        {
            City = RepeatedWhitespace.Replace(query.City?.Trim() ?? string.Empty, " ")
        };

        await _validator.ValidateAndThrowAsync(normalizedQuery, cancellationToken);

        return await _externalWeatherProvider.GetForecastAsync(
            normalizedQuery.City,
            normalizedQuery.Days,
            cancellationToken);
    }
}
