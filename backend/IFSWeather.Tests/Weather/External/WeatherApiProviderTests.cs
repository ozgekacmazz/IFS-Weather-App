using System.Net;
using System.Text;
using IFSWeather.Application.Weather.External.Exceptions;
using IFSWeather.Infrastructure.Weather.External;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Xunit;

namespace IFSWeather.Tests.Weather.External;

public sealed class WeatherApiProviderTests
{
    private const string ApiKey = "test-provider-key-that-must-not-be-logged";

    [Fact]
    public async Task GetForecastAsync_ConstructsEncodedRequestAndMapsResponse()
    {
        var handler = new StubHandler(_ => JsonResponse("""
            {
              "location": { "name": "New York", "country": "United States" },
              "forecast": {
                "forecastday": [
                  {
                    "date": "2026-07-23",
                    "day": {
                      "mintemp_c": 20.1,
                      "maxtemp_c": 29.4,
                      "avgtemp_c": 24.7,
                      "condition": {
                        "text": "Partly cloudy",
                        "icon": "//cdn.weatherapi.com/icon.png"
                      }
                    }
                  }
                ]
              }
            }
            """));
        using var cancellation = new CancellationTokenSource();
        var provider = CreateProvider(handler);

        var result = await provider.GetForecastAsync(
            "New York & Queens",
            2,
            cancellation.Token);

        Assert.True(handler.CancellationToken.CanBeCanceled);
        Assert.NotNull(handler.RequestUri);
        Assert.Equal("/v1/forecast.json", handler.RequestUri.AbsolutePath);
        Assert.Contains("key=test-provider-key-that-must-not-be-logged", handler.RequestUri.Query);
        Assert.Contains("q=New%20York%20%26%20Queens", handler.RequestUri.Query);
        Assert.Contains("days=2", handler.RequestUri.Query);
        Assert.Contains("aqi=no", handler.RequestUri.Query);
        Assert.Contains("alerts=no", handler.RequestUri.Query);
        Assert.Equal("New York", result.CityName);
        Assert.Equal("United States", result.Country);
        Assert.Equal(new DateOnly(2026, 7, 23), result.StartDate);
        var day = Assert.Single(result.Days);
        Assert.Equal(20.1m, day.MinimumTemperature);
        Assert.Equal(29.4m, day.MaximumTemperature);
        Assert.Equal(24.7m, day.AverageTemperature);
        Assert.Equal("Partly cloudy", day.MainStatus);
        Assert.Equal("https://cdn.weatherapi.com/icon.png", day.IconUrl);
    }

    [Fact]
    public async Task GetForecastAsync_TranslatesMissingLocation()
    {
        var provider = CreateProvider(new StubHandler(_ =>
            JsonResponse("""{ "error": { "code": 1006, "message": "No matching location." } }""",
                HttpStatusCode.BadRequest)));

        await Assert.ThrowsAsync<ExternalWeatherCityNotFoundException>(() =>
            provider.GetForecastAsync(
                "Missing",
                1,
                TestContext.Current.CancellationToken));
    }

    [Theory]
    [InlineData(HttpStatusCode.TooManyRequests, 2007)]
    [InlineData(HttpStatusCode.TooManyRequests, null)]
    public async Task GetForecastAsync_TranslatesRateLimit(
        HttpStatusCode status,
        int? providerCode)
    {
        var body = providerCode is null
            ? """{ "error": { "message": "limited" } }"""
            : $$"""{ "error": { "code": {{providerCode}}, "message": "limited" } }""";
        var provider = CreateProvider(new StubHandler(_ => JsonResponse(body, status)));

        await Assert.ThrowsAsync<ExternalWeatherRateLimitException>(() =>
            provider.GetForecastAsync(
                "Ankara",
                1,
                TestContext.Current.CancellationToken));
    }

    [Theory]
    [InlineData("""{ "location": null, "forecast": null }""")]
    [InlineData("""{ "location": { "name": "A", "country": "B" }, "forecast": { "forecastday": [] } }""")]
    [InlineData("""{ "location": { "name": "A", "country": "B" }, "forecast": { "forecastday": [{ "date": "bad", "day": {} }] } }""")]
    [InlineData("""not-json""")]
    public async Task GetForecastAsync_RejectsMalformedProviderResponse(string body)
    {
        var provider = CreateProvider(new StubHandler(_ => JsonResponse(body)));

        await Assert.ThrowsAsync<ExternalWeatherUnavailableException>(() =>
            provider.GetForecastAsync(
                "Ankara",
                1,
                TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task GetForecastAsync_TranslatesProviderTimeoutAndDoesNotLogSecret()
    {
        var logger = new RecordingLogger();
        var provider = CreateProvider(
            new StubHandler(_ => throw new TaskCanceledException("provider URL secret")),
            logger);

        await Assert.ThrowsAsync<ExternalWeatherUnavailableException>(() =>
            provider.GetForecastAsync("Ankara", 1, CancellationToken.None));

        Assert.NotEmpty(logger.Messages);
        Assert.DoesNotContain(logger.Messages, message => message.Contains(ApiKey));
        Assert.DoesNotContain(logger.Messages, message => message.Contains("forecast.json"));
        Assert.DoesNotContain(logger.Messages, message => message.Contains("provider URL secret"));
    }

    [Fact]
    public async Task GetForecastAsync_PropagatesCallerCancellation()
    {
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();
        var provider = CreateProvider(new StubHandler(_ =>
            throw new OperationCanceledException(cancellation.Token)));

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            provider.GetForecastAsync("Ankara", 1, cancellation.Token));
    }

    private static WeatherApiProvider CreateProvider(
        HttpMessageHandler handler,
        ILogger<WeatherApiProvider>? logger = null)
    {
        var client = new HttpClient(handler)
        {
            BaseAddress = new Uri("https://api.weatherapi.com/v1/")
        };
        var options = Options.Create(new WeatherApiOptions
        {
            BaseUrl = client.BaseAddress.ToString(),
            ApiKey = ApiKey,
            MaximumForecastDays = 3,
            TimeoutSeconds = 10
        });

        return new WeatherApiProvider(
            client,
            options,
            logger ?? new RecordingLogger());
    }

    private static HttpResponseMessage JsonResponse(
        string body,
        HttpStatusCode status = HttpStatusCode.OK) =>
        new(status)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };

    private sealed class StubHandler(
        Func<HttpRequestMessage, HttpResponseMessage> responseFactory)
        : HttpMessageHandler
    {
        public Uri? RequestUri { get; private set; }

        public CancellationToken CancellationToken { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            RequestUri = request.RequestUri;
            CancellationToken = cancellationToken;
            return Task.FromResult(responseFactory(request));
        }
    }

    private sealed class RecordingLogger : ILogger<WeatherApiProvider>
    {
        public List<string> Messages { get; } = [];

        public IDisposable? BeginScope<TState>(TState state)
            where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            Messages.Add(formatter(state, exception));
        }
    }
}
