using IFSWeather.Application.Weather.DTOs;
using IFSWeather.Application.Weather.Models;

namespace IFSWeather.Application.Weather.Interfaces;

public interface IWeatherRecommendationService
{
    IReadOnlyList<WeatherRecommendationResponse> GetRecommendations(
        WeatherRecommendationContext context);
}
