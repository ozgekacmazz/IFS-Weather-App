namespace IFSWeather.Application.Weather.DTOs;

public sealed record SaveWeatherPreviewResponse(
    bool Inserted,
    WeatherResponse Weather);
