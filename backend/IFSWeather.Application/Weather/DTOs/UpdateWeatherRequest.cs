namespace IFSWeather.Application.Weather.DTOs;

public sealed record UpdateWeatherRequest(
    DateOnly WeatherDate,
    string CityName,
    decimal Temperature,
    string MainStatus);
