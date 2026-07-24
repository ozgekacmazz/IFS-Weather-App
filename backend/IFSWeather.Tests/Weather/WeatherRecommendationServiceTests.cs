using IFSWeather.Application.Weather.DTOs;
using IFSWeather.Application.Weather.Models;
using IFSWeather.Application.Weather.Services;
using Xunit;

namespace IFSWeather.Tests.Weather;

public sealed class WeatherRecommendationServiceTests
{
    private readonly WeatherRecommendationService _service = new();

    [Fact]
    public void GetRecommendations_VeryHot_ReturnsOrderedHealthSafetyAndAgricultureGuidance()
    {
        var recommendations = GetRecommendations(38m, "Clear");

        Assert.Collection(
            recommendations,
            item => AssertRecommendation(item, "Health", "Important", "Prioritize hydration"),
            item => AssertRecommendation(item, "Safety", "Warning", "Limit heat and sun exposure"),
            item => AssertRecommendation(item, "Agriculture", "Warning", "Avoid midday watering"));
    }

    [Fact]
    public void GetRecommendations_Hot_ReturnsClothingAndHealthGuidance()
    {
        var recommendations = GetRecommendations(30m, "Cloudy");

        Assert.Collection(
            recommendations,
            item => AssertRecommendation(item, "Clothing", "Info", "Choose breathable clothing"),
            item => AssertRecommendation(item, "Health", "Warning", "Stay hydrated and sun-aware"));
    }

    [Fact]
    public void GetRecommendations_Freezing_IncludesColdSafetyAndAgricultureGuidance()
    {
        var recommendations = GetRecommendations(-4m, "Cloudy");

        Assert.Collection(
            recommendations,
            item => AssertRecommendation(item, "Clothing", "Warning", "Wear warm layers"),
            item => AssertRecommendation(item, "Safety", "Important", "Watch for ice and cold exposure"),
            item => AssertRecommendation(item, "Agriculture", "Warning", "Protect frost-sensitive plants"));
    }

    [Fact]
    public void GetRecommendations_Cold_ReturnsWarmClothingGuidance()
    {
        var recommendation = Assert.Single(GetRecommendations(8m, "Cloudy"));

        AssertRecommendation(
            recommendation,
            "Clothing",
            "Warning",
            "Wear warm layers");
    }

    [Theory]
    [InlineData("Heavy RAIN")]
    [InlineData("Patchy DrIzZlE")]
    public void GetRecommendations_RainKeywordsAreCaseInsensitiveAndIncludePlantCare(
        string condition)
    {
        var recommendations = GetRecommendations(18m, condition);

        Assert.Collection(
            recommendations,
            item => AssertRecommendation(item, "Clothing", "Info", "Take rain protection"),
            item => AssertRecommendation(item, "Agriculture", "Info", "Pause unnecessary watering"));
    }

    [Fact]
    public void GetRecommendations_WindKeyword_ReturnsOutdoorSafetyGuidance()
    {
        var recommendation = Assert.Single(
            GetRecommendations(18m, "Very WiNdY"));

        AssertRecommendation(
            recommendation,
            "Safety",
            "Warning",
            "Secure loose outdoor items");
    }

    [Theory]
    [InlineData("Thunderstorm")]
    [InlineData("THUNDER showers")]
    public void GetRecommendations_StormKeywords_ReturnImportantSafetyGuidance(
        string condition)
    {
        var recommendations = GetRecommendations(18m, condition);

        Assert.Contains(
            recommendations,
            item => item.Category == "Safety"
                && item.Priority == "Important"
                && item.Title == "Postpone exposed outdoor activity");
    }

    [Theory]
    [InlineData("Snow")]
    [InlineData("Heavy BLIZZARD")]
    public void GetRecommendations_SnowKeywords_ReturnTravelThenClothingGuidance(
        string condition)
    {
        var recommendations = GetRecommendations(5m, condition);

        Assert.Equal(
            ["Wear warm layers", "Prepare for difficult travel", "Use insulated clothing"],
            recommendations.Select(item => item.Title));
    }

    [Theory]
    [InlineData("Clear")]
    [InlineData("Mostly SUNNY")]
    public void GetRecommendations_MildAndClear_ReturnsOutdoorActivityGuidance(
        string condition)
    {
        var recommendation = Assert.Single(GetRecommendations(22m, condition));

        AssertRecommendation(
            recommendation,
            "Activity",
            "Info",
            "Good conditions for outdoor activity");
    }

    [Fact]
    public void GetRecommendations_CombinedCondition_UsesStableRuleOrdering()
    {
        var first = GetRecommendations(18m, "Wind and rain with thunder");
        var second = GetRecommendations(18m, "Wind and rain with thunder");

        Assert.Equal(
            [
                "Take rain protection",
                "Pause unnecessary watering",
                "Postpone exposed outdoor activity",
                "Secure loose outdoor items"
            ],
            first.Select(item => item.Title));
        Assert.Equal(first, second);
    }

    [Fact]
    public void GetRecommendations_NoSpecialRule_ReturnsGeneralFallback()
    {
        var recommendation = Assert.Single(
            GetRecommendations(18m, "Overcast"));

        AssertRecommendation(
            recommendation,
            "General",
            "Info",
            "Plan for current conditions");
        Assert.Equal("general", recommendation.IconKey);
    }

    private IReadOnlyList<WeatherRecommendationResponse>
        GetRecommendations(decimal temperature, string condition)
    {
        return _service.GetRecommendations(
            new WeatherRecommendationContext(
                temperature,
                condition,
                new DateOnly(2026, 7, 24)));
    }

    private static void AssertRecommendation(
        WeatherRecommendationResponse recommendation,
        string category,
        string priority,
        string title)
    {
        Assert.Equal(category, recommendation.Category);
        Assert.Equal(priority, recommendation.Priority);
        Assert.Equal(title, recommendation.Title);
        Assert.False(string.IsNullOrWhiteSpace(recommendation.Message));
        Assert.False(string.IsNullOrWhiteSpace(recommendation.IconKey));
    }
}
