namespace IFSWeather.Application.Weather.Models;

public sealed record WeatherForecastQuery
{
    public string? City { get; init; }

    public int Days { get; init; } = 7;
}
