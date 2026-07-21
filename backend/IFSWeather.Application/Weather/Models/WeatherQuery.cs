namespace IFSWeather.Application.Weather.Models;

public sealed record WeatherQuery
{
    public int PageNumber { get; init; } = 1;

    public int PageSize { get; init; } = 20;

    public string? City { get; init; }

    public DateOnly? Date { get; init; }
}
