using FluentValidation;
using IFSWeather.Application.Weather.External.Interfaces;
using IFSWeather.Application.Weather.External.Models;

namespace IFSWeather.Application.Weather.External.Services;

public sealed class ExternalLocationSearchService : IExternalLocationSearchService
{
    private readonly IExternalWeatherProvider _externalWeatherProvider;
    private readonly IValidator<ExternalLocationQuery> _validator;

    public ExternalLocationSearchService(
        IExternalWeatherProvider externalWeatherProvider,
        IValidator<ExternalLocationQuery> validator)
    {
        _externalWeatherProvider = externalWeatherProvider;
        _validator = validator;
    }

    public async Task<IReadOnlyList<ExternalLocation>> SearchAsync(
        ExternalLocationQuery query,
        CancellationToken cancellationToken = default)
    {
        var trimmedQuery = query with
        {
            Query = query.Query?.Trim() ?? string.Empty
        };

        await _validator.ValidateAndThrowAsync(trimmedQuery, cancellationToken);

        return await _externalWeatherProvider.SearchLocationsAsync(
            trimmedQuery.Query,
            cancellationToken);
    }
}
