namespace IFSWeather.Application.Weather.External.Models;

public sealed record ExternalCoordinateForecastQuery
{
    public decimal? Latitude { get; init; }

    public decimal? Longitude { get; init; }

    public int Days { get; init; } = 3;
}
