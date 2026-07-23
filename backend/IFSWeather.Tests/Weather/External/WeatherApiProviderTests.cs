using System.Net;
using System.Text;
using System.Globalization;
using IFSWeather.Application.Weather.External.Exceptions;
using IFSWeather.Infrastructure.Weather.External;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.AspNetCore.WebUtilities;
using Xunit;

namespace IFSWeather.Tests.Weather.External;

public sealed class WeatherApiProviderTests
{
    private const string ApiKey = "test-provider-key-that-must-not-be-logged";

    [Theory]
    [InlineData("37.8450123456789", "27.839987654321")]
    [InlineData("-23.5505199", "-46.6333094")]
    [InlineData("48.137154", "11.576124")]
    [InlineData("-90", "180")]
    public async Task GetForecastByCoordinatesAsync_SerializesCoordinatesInOrderWithPrecision(
        string latitudeText,
        string longitudeText)
    {
        var handler = new StubHandler(_ => ValidForecastResponse());
        var provider = CreateProvider(handler);
        var latitude = decimal.Parse(latitudeText, CultureInfo.InvariantCulture);
        var longitude = decimal.Parse(longitudeText, CultureInfo.InvariantCulture);

        var result = await provider.GetForecastByCoordinatesAsync(
            latitude,
            longitude,
            3,
            TestContext.Current.CancellationToken);

        Assert.Equal("Aydın", result.CityName);
        Assert.NotNull(handler.RequestUri);
        Assert.Equal("/v1/forecast.json", handler.RequestUri.AbsolutePath);
        var providerQuery = QueryHelpers.ParseQuery(handler.RequestUri.Query)["q"];
        Assert.Equal($"{latitudeText},{longitudeText}", providerQuery);
        Assert.Contains("days=3", handler.RequestUri.Query);
    }

    [Fact]
    public async Task GetForecastByCoordinatesAsync_UsesInvariantFormattingUnderTurkishCulture()
    {
        var handler = new StubHandler(_ => ValidForecastResponse());
        var provider = CreateProvider(handler);
        var originalCulture = CultureInfo.CurrentCulture;
        var originalUiCulture = CultureInfo.CurrentUICulture;

        try
        {
            CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo("tr-TR");
            CultureInfo.CurrentUICulture = CultureInfo.GetCultureInfo("tr-TR");

            await provider.GetForecastByCoordinatesAsync(
                38.423734m,
                27.142826m,
                1,
                TestContext.Current.CancellationToken);
        }
        finally
        {
            CultureInfo.CurrentCulture = originalCulture;
            CultureInfo.CurrentUICulture = originalUiCulture;
        }

        Assert.NotNull(handler.RequestUri);
        var providerQuery = QueryHelpers.ParseQuery(handler.RequestUri.Query)["q"];
        Assert.Equal("38.423734,27.142826", providerQuery);
    }

    [Fact]
    public async Task SearchLocationsAsync_UsesEncodedSearchEndpointAndMapsOrderedResults()
    {
        var handler = new StubHandler(_ => JsonResponse("""
            [
              {
                "id": 1001,
                "name": "Aydın",
                "region": "Aydin",
                "country": "Turkey",
                "lat": 37.84,
                "lon": 27.84
              },
              {
                "id": 1002,
                "name": "Aydıncık",
                "region": "",
                "country": "Turkey",
                "lat": 36.14,
                "lon": 33.32
              }
            ]
            """));
        using var cancellation = new CancellationTokenSource();
        var provider = CreateProvider(handler);

        var result = await provider.SearchLocationsAsync("Aydın", cancellation.Token);

        Assert.True(handler.CancellationToken.CanBeCanceled);
        Assert.NotNull(handler.RequestUri);
        Assert.Equal("/v1/search.json", handler.RequestUri.AbsolutePath);
        Assert.Contains("q=Ayd%C4%B1n", handler.RequestUri.Query);
        Assert.DoesNotContain("q=aydin", handler.RequestUri.Query);
        Assert.Collection(
            result,
            location =>
            {
                Assert.Equal(1001, location.ProviderLocationId);
                Assert.Equal("Aydın", location.Name);
                Assert.Equal("Aydin", location.Region);
                Assert.Equal("Turkey", location.Country);
                Assert.Equal(37.84m, location.Latitude);
                Assert.Equal(27.84m, location.Longitude);
                Assert.Equal("Aydın, Aydin, Turkey", location.DisplayLabel);
            },
            location =>
            {
                Assert.Equal(1002, location.ProviderLocationId);
                Assert.Equal("Aydıncık", location.Name);
                Assert.Null(location.Region);
                Assert.Equal("Aydıncık, Turkey", location.DisplayLabel);
            });
    }

    [Theory]
    [InlineData("Aydın", "Ayd%C4%B1n")]
    [InlineData("İzmir", "%C4%B0zmir")]
    [InlineData("Şanlıurfa", "%C5%9Eanl%C4%B1urfa")]
    [InlineData("Çanakkale", "%C3%87anakkale")]
    [InlineData("Eskişehir", "Eski%C5%9Fehir")]
    [InlineData("München", "M%C3%BCnchen")]
    [InlineData("São Paulo", "S%C3%A3o%20Paulo")]
    [InlineData("Kraków", "Krak%C3%B3w")]
    public async Task SearchLocationsAsync_PreservesAndEncodesUnicodeQuery(
        string query,
        string encodedQuery)
    {
        var handler = new StubHandler(_ => JsonResponse("[]"));
        var provider = CreateProvider(handler);

        var result = await provider.SearchLocationsAsync(
            query,
            TestContext.Current.CancellationToken);

        Assert.Empty(result);
        Assert.NotNull(handler.RequestUri);
        Assert.Contains($"q={encodedQuery}", handler.RequestUri.Query);
    }

    [Fact]
    public async Task SearchLocationsAsync_ReturnsEmptyCollectionForNoMatches()
    {
        var provider = CreateProvider(new StubHandler(_ => JsonResponse("[]")));

        var result = await provider.SearchLocationsAsync(
            "Missing",
            TestContext.Current.CancellationToken);

        Assert.Empty(result);
    }

    [Theory]
    [InlineData(HttpStatusCode.TooManyRequests, typeof(ExternalWeatherRateLimitException))]
    [InlineData(HttpStatusCode.Unauthorized, typeof(ExternalWeatherConfigurationException))]
    [InlineData(HttpStatusCode.BadGateway, typeof(ExternalWeatherUnavailableException))]
    public async Task SearchLocationsAsync_TranslatesProviderFailure(
        HttpStatusCode status,
        Type expectedExceptionType)
    {
        var provider = CreateProvider(new StubHandler(_ =>
            JsonResponse("""{ "error": { "message": "provider failure" } }""", status)));

        var exception = await Record.ExceptionAsync(() =>
            provider.SearchLocationsAsync(
                "Aydın",
                TestContext.Current.CancellationToken));

        Assert.IsType(expectedExceptionType, exception);
    }

    [Fact]
    public async Task SearchLocationsAsync_TimeoutDoesNotLogSecretOrProviderUri()
    {
        var logger = new RecordingLogger();
        var provider = CreateProvider(
            new StubHandler(_ => throw new TaskCanceledException("secret-bearing URL")),
            logger);

        await Assert.ThrowsAsync<ExternalWeatherUnavailableException>(() =>
            provider.SearchLocationsAsync("Aydın", CancellationToken.None));

        Assert.NotEmpty(logger.Messages);
        Assert.DoesNotContain(logger.Messages, message => message.Contains(ApiKey));
        Assert.DoesNotContain(logger.Messages, message => message.Contains("search.json"));
        Assert.DoesNotContain(logger.Messages, message => message.Contains("secret-bearing URL"));
    }

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

    private static HttpResponseMessage ValidForecastResponse() =>
        JsonResponse("""
            {
              "location": { "name": "Aydın", "country": "Turkey" },
              "forecast": {
                "forecastday": [
                  {
                    "date": "2026-07-24",
                    "day": {
                      "mintemp_c": 20.1,
                      "maxtemp_c": 31.4,
                      "avgtemp_c": 25.7,
                      "condition": {
                        "text": "Sunny",
                        "icon": "//cdn.weatherapi.com/icon.png"
                      }
                    }
                  }
                ]
              }
            }
            """);

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
