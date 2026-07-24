using IFSWeather.Application.Weather.DTOs;
using IFSWeather.Application.Weather.Interfaces;
using IFSWeather.Application.Weather.Models;

namespace IFSWeather.Application.Weather.Services;

public sealed class WeatherRecommendationService : IWeatherRecommendationService
{
    public IReadOnlyList<WeatherRecommendationResponse> GetRecommendations(
        WeatherRecommendationContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        var recommendations = new List<WeatherRecommendationResponse>();
        var condition = context.MainStatus ?? string.Empty;

        AddTemperatureRecommendations(context.Temperature, recommendations);
        AddConditionRecommendations(
            context.Temperature,
            condition,
            recommendations);

        if (recommendations.Count == 0)
        {
            recommendations.Add(new WeatherRecommendationResponse(
                "General",
                "Plan for current conditions",
                "Check the latest conditions before heading out and adjust your plans as needed.",
                "Info",
                "general"));
        }

        return recommendations;
    }

    private static void AddTemperatureRecommendations(
        decimal temperature,
        ICollection<WeatherRecommendationResponse> recommendations)
    {
        if (temperature >= 35m)
        {
            recommendations.Add(new WeatherRecommendationResponse(
                "Health",
                "Prioritize hydration",
                "Drink water regularly and take breaks in a cool or shaded place.",
                "Important",
                "hydration"));
            recommendations.Add(new WeatherRecommendationResponse(
                "Safety",
                "Limit heat and sun exposure",
                "Avoid prolonged outdoor exposure during the hottest part of the day and use sun protection.",
                "Warning",
                "sun"));
            recommendations.Add(new WeatherRecommendationResponse(
                "Agriculture",
                "Avoid midday watering",
                "Water plants early or late in the day to reduce evaporation and heat stress.",
                "Warning",
                "plant"));
        }
        else if (temperature >= 28m)
        {
            recommendations.Add(new WeatherRecommendationResponse(
                "Clothing",
                "Choose breathable clothing",
                "Wear lightweight, breathable layers to stay comfortable.",
                "Info",
                "clothing"));
            recommendations.Add(new WeatherRecommendationResponse(
                "Health",
                "Stay hydrated and sun-aware",
                "Keep water nearby and use appropriate sun protection when outdoors.",
                "Warning",
                "hydration"));
        }

        if (temperature <= 10m)
        {
            recommendations.Add(new WeatherRecommendationResponse(
                "Clothing",
                "Wear warm layers",
                "Choose warm layered clothing and protect exposed skin outdoors.",
                "Warning",
                "clothing"));
        }

        if (temperature <= 0m)
        {
            recommendations.Add(new WeatherRecommendationResponse(
                "Safety",
                "Watch for ice and cold exposure",
                "Use caution on icy surfaces and limit prolonged exposure to freezing conditions.",
                "Important",
                "ice"));
            recommendations.Add(new WeatherRecommendationResponse(
                "Agriculture",
                "Protect frost-sensitive plants",
                "Cover or move vulnerable plants where possible before freezing conditions persist.",
                "Warning",
                "plant"));
        }
    }

    private static void AddConditionRecommendations(
        decimal temperature,
        string condition,
        ICollection<WeatherRecommendationResponse> recommendations)
    {
        var hasRain = ContainsAny(condition, "rain", "drizzle");
        var hasStorm = ContainsAny(condition, "storm", "thunder");
        var hasSnow = ContainsAny(condition, "snow", "blizzard");
        var hasWind = ContainsAny(condition, "wind");
        var isClear = ContainsAny(condition, "clear", "sunny");

        if (hasRain)
        {
            recommendations.Add(new WeatherRecommendationResponse(
                "Clothing",
                "Take rain protection",
                "Carry an umbrella or wear a raincoat when heading outside.",
                "Info",
                "umbrella"));
            recommendations.Add(new WeatherRecommendationResponse(
                "Agriculture",
                "Pause unnecessary watering",
                "Allow rainfall to support soil moisture before watering plants again.",
                "Info",
                "plant"));
        }

        if (hasStorm)
        {
            recommendations.Add(new WeatherRecommendationResponse(
                "Safety",
                "Postpone exposed outdoor activity",
                "Move plans indoors and avoid open or exposed areas while storm conditions continue.",
                "Important",
                "storm"));
        }

        if (hasSnow)
        {
            recommendations.Add(new WeatherRecommendationResponse(
                "Safety",
                "Prepare for difficult travel",
                "Allow extra travel time and watch for snow-covered or icy surfaces.",
                "Important",
                "snow"));
            recommendations.Add(new WeatherRecommendationResponse(
                "Clothing",
                "Use insulated clothing",
                "Wear insulated layers and weather-resistant footwear outdoors.",
                "Warning",
                "clothing"));
        }

        if (hasWind)
        {
            recommendations.Add(new WeatherRecommendationResponse(
                "Safety",
                "Secure loose outdoor items",
                "Use caution outdoors and secure objects that could be moved by strong wind.",
                "Warning",
                "wind"));
        }

        if (temperature >= 15m && temperature <= 27m && isClear)
        {
            recommendations.Add(new WeatherRecommendationResponse(
                "Activity",
                "Good conditions for outdoor activity",
                "Mild and clear conditions are suitable for a walk or other outdoor plans.",
                "Info",
                "outdoor"));
        }
    }

    private static bool ContainsAny(string value, params string[] keywords)
    {
        return keywords.Any(keyword =>
            value.Contains(keyword, StringComparison.OrdinalIgnoreCase));
    }
}
