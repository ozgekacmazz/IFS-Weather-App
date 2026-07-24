namespace IFSWeather.Application.Weather.Models;

public sealed record WeatherRecommendationContext(
    decimal Temperature,
    string MainStatus,
    DateOnly WeatherDate);
