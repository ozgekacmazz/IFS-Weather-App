namespace IFSWeather.Application.Weather.External.Models;

public sealed record ExternalLocationQuery
{
    public required string Query { get; init; }
}
