namespace IFSWeather.Application.Weather.Models;

public sealed record CurrentWeatherQuery
{
    public string? City { get; init; }
}
