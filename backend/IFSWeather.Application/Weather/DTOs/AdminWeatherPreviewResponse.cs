namespace IFSWeather.Application.Weather.DTOs;

public sealed record AdminWeatherPreviewResponse(
    decimal Latitude,
    decimal Longitude,
    string CityName,
    string DisplayLabel,
    DateOnly WeatherDate,
    decimal Temperature,
    decimal MinimumTemperature,
    decimal MaximumTemperature,
    decimal AverageHumidity,
    decimal MaximumWindSpeedKph,
    decimal PrecipitationProbability,
    string MainStatus);
