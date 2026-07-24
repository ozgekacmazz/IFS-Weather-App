namespace IFSWeather.Application.Weather.DTOs;

public sealed record AdminWeatherPreviewRequest(
    decimal Latitude,
    decimal Longitude,
    string CityName,
    string DisplayLabel);
