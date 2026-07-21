namespace IFSWeather.Application.Weather.External.Models;

public sealed record ExternalWeatherDay(
    DateOnly Date,
    decimal MinimumTemperature,
    decimal MaximumTemperature,
    decimal AverageTemperature,
    string MainStatus,
    string? IconUrl);
