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

    public ExternalWeatherService(
        IExternalWeatherProvider externalWeatherProvider,
        IValidator<ExternalForecastQuery> validator)
    {
        _externalWeatherProvider = externalWeatherProvider;
        _validator = validator;
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
