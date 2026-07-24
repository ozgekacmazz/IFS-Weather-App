namespace IFSWeather.Application.Weather.DTOs;

public sealed record CreateWeatherRequest(
    DateOnly WeatherDate,
    string CityName,
    decimal Temperature,
    decimal? MinimumTemperature,
    decimal? MaximumTemperature,
    decimal? AverageHumidity,
    decimal? MaximumWindSpeedKph,
    decimal? PrecipitationProbability,
    string MainStatus);
