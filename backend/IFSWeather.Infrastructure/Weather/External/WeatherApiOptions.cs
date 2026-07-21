namespace IFSWeather.Infrastructure.Weather.External;

public sealed class WeatherApiOptions
{
    public const string SectionName = "WeatherApi";

    public string BaseUrl { get; set; } = "https://api.weatherapi.com/v1/";

    public string ApiKey { get; set; } = string.Empty;

    public int TimeoutSeconds { get; set; } = 10;

    public int MaximumForecastDays { get; set; } = 3;
}
