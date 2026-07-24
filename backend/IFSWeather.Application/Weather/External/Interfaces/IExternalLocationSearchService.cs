using IFSWeather.Application.Weather.External.Models;

namespace IFSWeather.Application.Weather.External.Interfaces;

public interface IExternalLocationSearchService
{
    Task<IReadOnlyList<ExternalLocation>> SearchAsync(
        ExternalLocationQuery query,
        CancellationToken cancellationToken = default);
}
