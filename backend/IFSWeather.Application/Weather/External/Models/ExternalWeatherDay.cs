namespace IFSWeather.Application.Weather.External.Models;

public sealed record ExternalWeatherDay(
    DateOnly Date,
    decimal MinimumTemperature,
    decimal MaximumTemperature,
    decimal AverageTemperature,
    decimal AverageHumidity,
    decimal MaximumWindSpeedKph,
    decimal PrecipitationProbability,
    string MainStatus,
    string? IconUrl);
