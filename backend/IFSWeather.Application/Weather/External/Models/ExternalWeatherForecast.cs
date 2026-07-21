namespace IFSWeather.Application.Weather.External.Models;

public sealed record ExternalWeatherForecast(
    string CityName,
    string Country,
    DateOnly StartDate,
    IReadOnlyList<ExternalWeatherDay> Days);
