namespace IFSWeather.Application.Weather.DTOs;

public sealed record WeatherResponse(
    int WeatherId,
    DateOnly WeatherDate,
    string CityName,
    decimal Temperature,
    string MainStatus,
    DateTime CreatedAt,
    DateTime UpdatedAt);
