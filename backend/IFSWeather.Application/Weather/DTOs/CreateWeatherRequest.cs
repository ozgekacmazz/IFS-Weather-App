namespace IFSWeather.Application.Weather.DTOs;

public sealed record CreateWeatherRequest(
    DateOnly WeatherDate,
    string CityName,
    decimal Temperature,
    string MainStatus);
