namespace IFSWeather.Application.Weather.DTOs;

public sealed record WeatherForecastResponse(
    string CityName,
    DateOnly StartDate,
    int RequestedDays,
    IReadOnlyList<CurrentWeatherResponse> Items);
