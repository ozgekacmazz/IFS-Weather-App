namespace IFSWeather.Application.Weather.DTOs;

public sealed record WeatherRecommendationResponse(
    string Category,
    string Title,
    string Message,
    string Priority,
    string IconKey);
