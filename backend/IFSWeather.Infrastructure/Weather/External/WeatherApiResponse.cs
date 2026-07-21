using System.Text.Json.Serialization;

namespace IFSWeather.Infrastructure.Weather.External;

internal sealed class WeatherApiResponse
{
    public WeatherApiLocation? Location { get; init; }

    public WeatherApiForecast? Forecast { get; init; }
}

internal sealed class WeatherApiLocation
{
    public string? Name { get; init; }

    public string? Country { get; init; }
}

internal sealed class WeatherApiForecast
{
    [JsonPropertyName("forecastday")]
    public List<WeatherApiForecastDay>? Days { get; init; }
}

internal sealed class WeatherApiForecastDay
{
    public string? Date { get; init; }

    public WeatherApiDay? Day { get; init; }
}

internal sealed class WeatherApiDay
{
    [JsonPropertyName("mintemp_c")]
    public decimal? MinimumTemperature { get; init; }

    [JsonPropertyName("maxtemp_c")]
    public decimal? MaximumTemperature { get; init; }

    [JsonPropertyName("avgtemp_c")]
    public decimal? AverageTemperature { get; init; }

    public WeatherApiCondition? Condition { get; init; }
}

internal sealed class WeatherApiCondition
{
    public string? Text { get; init; }

    public string? Icon { get; init; }
}

internal sealed class WeatherApiErrorResponse
{
    public WeatherApiError? Error { get; init; }
}

internal sealed class WeatherApiError
{
    public int? Code { get; init; }

    public string? Message { get; init; }
}
