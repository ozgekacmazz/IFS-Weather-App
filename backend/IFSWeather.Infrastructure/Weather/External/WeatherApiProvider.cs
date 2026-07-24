using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using IFSWeather.Application.Weather.External.Exceptions;
using IFSWeather.Application.Weather.External.Interfaces;
using IFSWeather.Application.Weather.External.Models;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace IFSWeather.Infrastructure.Weather.External;

public sealed class WeatherApiProvider : IExternalWeatherProvider
{
    private const string ProviderName = "WeatherAPI";

    private static readonly JsonSerializerOptions SerializerOptions = new(
        JsonSerializerDefaults.Web);

    private readonly HttpClient _httpClient;
    private readonly WeatherApiOptions _options;
    private readonly ILogger<WeatherApiProvider> _logger;

    public WeatherApiProvider(
        HttpClient httpClient,
        IOptions<WeatherApiOptions> options,
        ILogger<WeatherApiProvider> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<IReadOnlyList<ExternalLocation>> SearchLocationsAsync(
        string query,
        CancellationToken cancellationToken = default)
    {
        var requestPath = QueryHelpers.AddQueryString(
            "search.json",
            new Dictionary<string, string?>
            {
                ["key"] = _options.ApiKey,
                ["q"] = query
            });

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, requestPath);
            using var response = await _httpClient.SendAsync(
                request,
                HttpCompletionOption.ResponseHeadersRead,
                cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                await ThrowForSearchFailureAsync(
                    response,
                    query,
                    cancellationToken);
            }

            await using var responseStream = await response.Content.ReadAsStreamAsync(
                cancellationToken);
            var providerResponse =
                await JsonSerializer.DeserializeAsync<List<WeatherApiSearchLocation>>(
                    responseStream,
                    SerializerOptions,
                    cancellationToken: cancellationToken);

            return MapSearchResponse(providerResponse);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            LogSearchFailure(query, "Timeout");
            throw new ExternalWeatherUnavailableException();
        }
        catch (HttpRequestException exception)
        {
            LogSearchFailure(query, exception.GetType().Name);
            throw new ExternalWeatherUnavailableException();
        }
        catch (JsonException exception)
        {
            LogSearchFailure(query, exception.GetType().Name);
            throw new ExternalWeatherUnavailableException();
        }
        catch (NotSupportedException exception)
        {
            LogSearchFailure(query, exception.GetType().Name);
            throw new ExternalWeatherUnavailableException();
        }
    }

    public async Task<ExternalWeatherForecast> GetForecastAsync(
        string city,
        int days,
        CancellationToken cancellationToken = default)
    {
        return await GetForecastCoreAsync(city, days, cancellationToken);
    }

    public async Task<ExternalWeatherForecast> GetForecastByCoordinatesAsync(
        decimal latitude,
        decimal longitude,
        int days,
        CancellationToken cancellationToken = default)
    {
        var coordinateQuery = string.Concat(
            latitude.ToString("G29", CultureInfo.InvariantCulture),
            ",",
            longitude.ToString("G29", CultureInfo.InvariantCulture));

        return await GetForecastCoreAsync(
            coordinateQuery,
            days,
            cancellationToken);
    }

    private async Task<ExternalWeatherForecast> GetForecastCoreAsync(
        string providerQuery,
        int days,
        CancellationToken cancellationToken)
    {
        if (days > _options.MaximumForecastDays)
        {
            throw new ExternalWeatherConfigurationException();
        }

        var requestPath = QueryHelpers.AddQueryString(
            "forecast.json",
            new Dictionary<string, string?>
            {
                ["key"] = _options.ApiKey,
                ["q"] = providerQuery,
                ["days"] = days.ToString(CultureInfo.InvariantCulture),
                ["aqi"] = "no",
                ["alerts"] = "no"
            });

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, requestPath);
            using var response = await _httpClient.SendAsync(
                request,
                HttpCompletionOption.ResponseHeadersRead,
                cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                await ThrowForFailureAsync(
                    response,
                    providerQuery,
                    days,
                    cancellationToken);
            }

            await using var responseStream = await response.Content.ReadAsStreamAsync(
                cancellationToken);
            var providerResponse = await JsonSerializer.DeserializeAsync<WeatherApiResponse>(
                responseStream,
                SerializerOptions,
                cancellationToken: cancellationToken);

            return MapResponse(providerResponse);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            LogFailure(providerQuery, days, "Timeout");
            throw new ExternalWeatherUnavailableException();
        }
        catch (HttpRequestException exception)
        {
            LogFailure(providerQuery, days, exception.GetType().Name);
            throw new ExternalWeatherUnavailableException();
        }
        catch (JsonException exception)
        {
            LogFailure(providerQuery, days, exception.GetType().Name);
            throw new ExternalWeatherUnavailableException();
        }
        catch (NotSupportedException exception)
        {
            LogFailure(providerQuery, days, exception.GetType().Name);
            throw new ExternalWeatherUnavailableException();
        }
    }

    private async Task ThrowForFailureAsync(
        HttpResponseMessage response,
        string city,
        int days,
        CancellationToken cancellationToken)
    {
        var providerErrorCode = await TryGetProviderErrorCodeAsync(
            response,
            cancellationToken);

        _logger.LogWarning(
            "External weather provider {Provider} returned status {StatusCode} and error code {ProviderErrorCode} for city {City} and {Days} days.",
            ProviderName,
            (int)response.StatusCode,
            providerErrorCode,
            city,
            days);

        switch (providerErrorCode)
        {
            case 1006:
                throw new ExternalWeatherCityNotFoundException();
            case 1002:
            case 2006:
            case 2008:
            case 2009:
                throw new ExternalWeatherConfigurationException();
            case 2007:
                throw new ExternalWeatherRateLimitException();
            case 9999:
                throw new ExternalWeatherUnavailableException();
        }

        switch (response.StatusCode)
        {
            case HttpStatusCode.TooManyRequests:
                throw new ExternalWeatherRateLimitException();
            case HttpStatusCode.Unauthorized:
            case HttpStatusCode.Forbidden:
                throw new ExternalWeatherConfigurationException();
            default:
                throw new ExternalWeatherUnavailableException();
        }
    }

    private async Task ThrowForSearchFailureAsync(
        HttpResponseMessage response,
        string query,
        CancellationToken cancellationToken)
    {
        var providerErrorCode = await TryGetProviderErrorCodeAsync(
            response,
            cancellationToken);

        _logger.LogWarning(
            "External weather provider {Provider} returned status {StatusCode} and error code {ProviderErrorCode} for location search query {Query}.",
            ProviderName,
            (int)response.StatusCode,
            providerErrorCode,
            query);

        switch (providerErrorCode)
        {
            case 1006:
                throw new ExternalWeatherCityNotFoundException();
            case 1002:
            case 2006:
            case 2008:
            case 2009:
                throw new ExternalWeatherConfigurationException();
            case 2007:
                throw new ExternalWeatherRateLimitException();
            case 9999:
                throw new ExternalWeatherUnavailableException();
        }

        switch (response.StatusCode)
        {
            case HttpStatusCode.TooManyRequests:
                throw new ExternalWeatherRateLimitException();
            case HttpStatusCode.Unauthorized:
            case HttpStatusCode.Forbidden:
                throw new ExternalWeatherConfigurationException();
            default:
                throw new ExternalWeatherUnavailableException();
        }
    }

    private static async Task<int?> TryGetProviderErrorCodeAsync(
        HttpResponseMessage response,
        CancellationToken cancellationToken)
    {
        try
        {
            await using var responseStream = await response.Content.ReadAsStreamAsync(
                cancellationToken);
            var errorResponse = await JsonSerializer.DeserializeAsync<WeatherApiErrorResponse>(
                responseStream,
                SerializerOptions,
                cancellationToken);

            return errorResponse?.Error?.Code;
        }
        catch (JsonException)
        {
            return null;
        }
        catch (NotSupportedException)
        {
            return null;
        }
    }

    private static ExternalWeatherForecast MapResponse(WeatherApiResponse? response)
    {
        if (response?.Location is null
            || string.IsNullOrWhiteSpace(response.Location.Name)
            || string.IsNullOrWhiteSpace(response.Location.Country)
            || response.Forecast?.Days is not { Count: > 0 } providerDays)
        {
            throw new ExternalWeatherUnavailableException();
        }

        var days = providerDays.Select(MapDay).ToArray();

        return new ExternalWeatherForecast(
            response.Location.Name,
            response.Location.Country,
            days[0].Date,
            days);
    }

    private static IReadOnlyList<ExternalLocation> MapSearchResponse(
        List<WeatherApiSearchLocation>? response)
    {
        if (response is null)
        {
            throw new ExternalWeatherUnavailableException();
        }

        return response.Select(MapSearchLocation).ToArray();
    }

    private static ExternalLocation MapSearchLocation(
        WeatherApiSearchLocation providerLocation)
    {
        if (string.IsNullOrWhiteSpace(providerLocation.Name)
            || string.IsNullOrWhiteSpace(providerLocation.Country)
            || providerLocation.Lat is not decimal latitude
            || providerLocation.Lon is not decimal longitude)
        {
            throw new ExternalWeatherUnavailableException();
        }

        var name = providerLocation.Name.Trim();
        var region = string.IsNullOrWhiteSpace(providerLocation.Region)
            ? null
            : providerLocation.Region.Trim();
        var country = providerLocation.Country.Trim();
        var displayLabel = string.Join(
            ", ",
            new[] { name, region, country }.Where(
                component => !string.IsNullOrWhiteSpace(component)));

        return new ExternalLocation(
            providerLocation.Id,
            name,
            region,
            country,
            latitude,
            longitude,
            displayLabel);
    }

    private static ExternalWeatherDay MapDay(WeatherApiForecastDay? providerDay)
    {
        if (providerDay is null
            || !DateOnly.TryParseExact(
                providerDay.Date,
                "yyyy-MM-dd",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var date)
            || providerDay.Day is not { } day
            || day.MinimumTemperature is not decimal minimumTemperature
            || day.MaximumTemperature is not decimal maximumTemperature
            || day.AverageTemperature is not decimal averageTemperature
            || day.AverageHumidity is not decimal averageHumidity
            || day.MaximumWindSpeedKph is not decimal maximumWindSpeedKph
            || day.PrecipitationProbability is not decimal precipitationProbability
            || minimumTemperature > averageTemperature
            || averageTemperature > maximumTemperature
            || averageHumidity is < 0m or > 100m
            || maximumWindSpeedKph is < 0m or > 500m
            || precipitationProbability is < 0m or > 100m
            || string.IsNullOrWhiteSpace(day.Condition?.Text))
        {
            throw new ExternalWeatherUnavailableException();
        }

        return new ExternalWeatherDay(
            date,
            minimumTemperature,
            maximumTemperature,
            averageTemperature,
            averageHumidity,
            maximumWindSpeedKph,
            precipitationProbability,
            day.Condition.Text,
            NormalizeIconUrl(day.Condition.Icon));
    }

    private static string? NormalizeIconUrl(string? iconUrl)
    {
        if (string.IsNullOrWhiteSpace(iconUrl))
        {
            return null;
        }

        return iconUrl.StartsWith("//", StringComparison.Ordinal)
            ? $"https:{iconUrl}"
            : iconUrl;
    }

    private void LogFailure(string city, int days, string exceptionType)
    {
        _logger.LogWarning(
            "External weather provider {Provider} failed for city {City} and {Days} days with {ExceptionType}.",
            ProviderName,
            city,
            days,
            exceptionType);
    }

    private void LogSearchFailure(string query, string exceptionType)
    {
        _logger.LogWarning(
            "External weather provider {Provider} failed for location search query {Query} with {ExceptionType}.",
            ProviderName,
            query,
            exceptionType);
    }
}
