namespace IFSWeather.Application.Weather.DTOs;

public sealed record CurrentWeatherResponse(
    int WeatherId,
    DateOnly WeatherDate,
    string CityName,
    decimal Temperature,
    string MainStatus,
    DateTime UpdatedAt);
