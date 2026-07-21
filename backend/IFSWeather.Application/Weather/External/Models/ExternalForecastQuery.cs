namespace IFSWeather.Application.Weather.External.Models;

public sealed record ExternalForecastQuery
{
    public required string City { get; init; }

    public int Days { get; init; } = 3;
}
