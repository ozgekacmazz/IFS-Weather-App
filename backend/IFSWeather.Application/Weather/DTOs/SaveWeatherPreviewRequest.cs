namespace IFSWeather.Application.Weather.DTOs;

public sealed record SaveWeatherPreviewRequest(
    DateOnly WeatherDate,
    string CityName,
    string DisplayLabel,
    decimal Latitude,
    decimal Longitude,
    decimal Temperature,
    string MainStatus);
