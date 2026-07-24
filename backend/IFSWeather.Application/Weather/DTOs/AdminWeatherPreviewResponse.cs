namespace IFSWeather.Application.Weather.DTOs;

public sealed record AdminWeatherPreviewResponse(
    decimal Latitude,
    decimal Longitude,
    string CityName,
    string DisplayLabel,
    DateOnly WeatherDate,
    decimal Temperature,
    string MainStatus);
