namespace IFSWeather.Application.Weather.DTOs;

public sealed record WeatherResponse(
    int WeatherId,
    DateOnly WeatherDate,
    string CityName,
    decimal Temperature,
    decimal? MinimumTemperature,
    decimal? MaximumTemperature,
    decimal? AverageHumidity,
    decimal? MaximumWindSpeedKph,
    decimal? PrecipitationProbability,
    string MainStatus,
    DateTime CreatedAt,
    DateTime UpdatedAt);
