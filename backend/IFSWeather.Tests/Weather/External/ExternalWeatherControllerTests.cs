using System.Reflection;
using System.Globalization;
using System.Net;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json;
using FluentValidation;
using FluentValidation.Results;
using IFSWeather.Api.Controllers;
using IFSWeather.Api.ExceptionHandling;
using IFSWeather.Application.Weather.External.Interfaces;
using IFSWeather.Application.Weather.External.Models;
using IFSWeather.Application.Weather.External.Validators;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Xunit;

namespace IFSWeather.Tests.Weather.External;

public sealed class ExternalWeatherControllerTests
{
    [Fact]
    public async Task GetForecastByCoordinates_ReturnsForecastAndForwardsCoordinates()
    {
        var weatherService = new StubWeatherService();
        var controller = new ExternalWeatherController(
            weatherService,
            new StubLocationSearchService());
        var query = new ExternalCoordinateForecastQuery
        {
            Latitude = 37.845m,
            Longitude = 27.839m,
            Days = 1
        };
        using var cancellation = new CancellationTokenSource();

        var result = await controller.GetForecastByCoordinates(
            query,
            cancellation.Token);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Same(weatherService.Response, ok.Value);
        Assert.Same(query, weatherService.CoordinateQuery);
        Assert.Equal(cancellation.Token, weatherService.CancellationToken);
    }

    [Fact]
    public async Task GetForecastByCoordinates_PropagatesValidationFailure()
    {
        var weatherService = new StubWeatherService
        {
            CoordinateException = new ValidationException(
                [new ValidationFailure("Latitude", "'Latitude' must not be empty.")])
        };
        var controller = new ExternalWeatherController(
            weatherService,
            new StubLocationSearchService());

        await Assert.ThrowsAsync<ValidationException>(() =>
            controller.GetForecastByCoordinates(
                new ExternalCoordinateForecastQuery { Longitude = 27.84m },
                TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task SearchLocations_ReturnsStructuredCollectionAndPropagatesCancellation()
    {
        var locationSearchService = new StubLocationSearchService();
        var controller = new ExternalWeatherController(
            new StubWeatherService(),
            locationSearchService);
        using var cancellation = new CancellationTokenSource();

        var result = await controller.SearchLocations("Aydın", cancellation.Token);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Same(locationSearchService.Response, ok.Value);
        Assert.Equal("Aydın", locationSearchService.Query?.Query);
        Assert.Equal(cancellation.Token, locationSearchService.CancellationToken);
    }

    [Fact]
    public async Task SearchLocations_PropagatesValidationFailure()
    {
        var locationSearchService = new StubLocationSearchService
        {
            Exception = new ValidationException(
                [new ValidationFailure("Query", "'Query' must not be empty.")])
        };
        var controller = new ExternalWeatherController(
            new StubWeatherService(),
            locationSearchService);

        await Assert.ThrowsAsync<ValidationException>(() =>
            controller.SearchLocations(
                " ",
                TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task SearchLocations_ReturnsEmptyCollectionForNoMatches()
    {
        var locationSearchService = new StubLocationSearchService
        {
            Response = []
        };
        var controller = new ExternalWeatherController(
            new StubWeatherService(),
            locationSearchService);

        var result = await controller.SearchLocations(
            "Missing",
            TestContext.Current.CancellationToken);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var locations = Assert.IsAssignableFrom<IReadOnlyList<ExternalLocation>>(ok.Value);
        Assert.Empty(locations);
    }

    [Fact]
    public async Task PublicQueryString_BindsDenizliWithoutComplexModelPrefix()
    {
        await using var fixture = await HttpFixture.StartAsync();

        var response = await fixture.Client.GetAsync(
            "/api/weather/external/locations?query=Denizli",
            TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Denizli", fixture.LocationSearchService.Query?.Query);
        Assert.DoesNotContain(
            "query.Query",
            await response.Content.ReadAsStringAsync(
                TestContext.Current.CancellationToken),
            StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("/api/weather/external/locations")]
    [InlineData("/api/weather/external/locations?query=%20%20")]
    public async Task PublicQueryString_MissingOrBlankQueryReturnsSafeValidation(
        string requestPath)
    {
        await using var fixture = await HttpFixture.StartAsync();

        var response = await fixture.Client.GetAsync(
            requestPath,
            TestContext.Current.CancellationToken);

        await AssertSafeValidationProblem(response);
    }

    [Fact]
    public async Task PublicQueryString_OverlongQueryReturnsSafeValidation()
    {
        await using var fixture = await HttpFixture.StartAsync();
        var query = new string(
            'a',
            ExternalLocationQueryValidator.MaximumQueryLength + 1);

        var response = await fixture.Client.GetAsync(
            $"/api/weather/external/locations?query={query}",
            TestContext.Current.CancellationToken);

        await AssertSafeValidationProblem(response);
    }

    [Fact]
    public void Controller_RetainsAuthenticationAndLocationRoute()
    {
        Assert.NotNull(typeof(ExternalWeatherController).GetCustomAttribute<AuthorizeAttribute>());

        var action = typeof(ExternalWeatherController).GetMethod(
            nameof(ExternalWeatherController.SearchLocations));
        var route = Assert.Single(action!.GetCustomAttributes<HttpGetAttribute>());

        Assert.Equal("locations", route.Template);
    }

    [Fact]
    public void CoordinateForecast_RetainsAuthenticationAndNonConflictingRoute()
    {
        var authorize =
            typeof(ExternalWeatherController).GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(authorize);
        Assert.Null(authorize.Roles);

        var action = typeof(ExternalWeatherController).GetMethod(
            nameof(ExternalWeatherController.GetForecastByCoordinates));
        var route = Assert.Single(action!.GetCustomAttributes<HttpGetAttribute>());

        Assert.Equal("forecast/coordinates", route.Template);
        Assert.Equal(typeof(decimal?), typeof(ExternalCoordinateForecastQuery)
            .GetProperty(nameof(ExternalCoordinateForecastQuery.Latitude))!.PropertyType);
        Assert.Equal(typeof(decimal?), typeof(ExternalCoordinateForecastQuery)
            .GetProperty(nameof(ExternalCoordinateForecastQuery.Longitude))!.PropertyType);
    }

    [Theory]
    [InlineData("not-a-number")]
    [InlineData("NaN")]
    [InlineData("Infinity")]
    [InlineData("-Infinity")]
    public void CoordinateForecast_DecimalContractRejectsNonFiniteOrNonNumericValues(
        string value)
    {
        Assert.False(decimal.TryParse(
            value,
            NumberStyles.Number,
            CultureInfo.InvariantCulture,
            out _));
    }

    private static async Task AssertSafeValidationProblem(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(
            "application/problem+json",
            response.Content.Headers.ContentType?.MediaType);

        using var document = JsonDocument.Parse(
            await response.Content.ReadAsStringAsync(
                TestContext.Current.CancellationToken));
        var root = document.RootElement;

        Assert.Equal(400, root.GetProperty("status").GetInt32());
        Assert.True(root.GetProperty("errors").EnumerateObject().Any());
        Assert.DoesNotContain(
            "query.Query",
            root.GetRawText(),
            StringComparison.Ordinal);
    }

    private sealed class HttpFixture : IAsyncDisposable
    {
        private readonly WebApplication _application;

        private HttpFixture(
            WebApplication application,
            HttpClient client,
            ValidatingLocationSearchService locationSearchService)
        {
            _application = application;
            Client = client;
            LocationSearchService = locationSearchService;
        }

        public HttpClient Client { get; }

        public ValidatingLocationSearchService LocationSearchService { get; }

        public static async Task<HttpFixture> StartAsync()
        {
            var locationSearchService = new ValidatingLocationSearchService();
            var builder = WebApplication.CreateBuilder(
                new WebApplicationOptions
                {
                    EnvironmentName = Environments.Development
                });
            builder.WebHost.UseUrls("http://127.0.0.1:0");
            builder.Services
                .AddAuthentication(TestAuthenticationHandler.SchemeName)
                .AddScheme<AuthenticationSchemeOptions, TestAuthenticationHandler>(
                    TestAuthenticationHandler.SchemeName,
                    _ => { });
            builder.Services.AddAuthorization();
            builder.Services.AddProblemDetails();
            builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
            builder.Services.AddSingleton<IExternalWeatherService>(
                new StubWeatherService());
            builder.Services.AddSingleton<IExternalLocationSearchService>(
                locationSearchService);
            builder.Services
                .AddControllers()
                .AddApplicationPart(typeof(ExternalWeatherController).Assembly);

            var application = builder.Build();
            application.UseExceptionHandler();
            application.UseAuthentication();
            application.UseAuthorization();
            application.MapControllers();
            await application.StartAsync(TestContext.Current.CancellationToken);

            var server = application.Services.GetRequiredService<IServer>();
            var address = Assert.Single(
                server.Features.Get<IServerAddressesFeature>()!.Addresses);
            var client = new HttpClient
            {
                BaseAddress = new Uri(address)
            };

            return new HttpFixture(application, client, locationSearchService);
        }

        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await _application.DisposeAsync();
        }
    }

    private sealed class ValidatingLocationSearchService
        : IExternalLocationSearchService
    {
        private readonly ExternalLocationQueryValidator _validator = new();

        public ExternalLocationQuery? Query { get; private set; }

        public async Task<IReadOnlyList<ExternalLocation>> SearchAsync(
            ExternalLocationQuery query,
            CancellationToken cancellationToken = default)
        {
            Query = query;
            var trimmedQuery = query with
            {
                Query = query.Query?.Trim() ?? string.Empty
            };
            await _validator.ValidateAndThrowAsync(
                trimmedQuery,
                cancellationToken);

            return [];
        }
    }

    private sealed class TestAuthenticationHandler
        : AuthenticationHandler<AuthenticationSchemeOptions>
    {
        public const string SchemeName = "Test";

        public TestAuthenticationHandler(
            IOptionsMonitor<AuthenticationSchemeOptions> options,
            ILoggerFactory logger,
            UrlEncoder encoder)
            : base(options, logger, encoder)
        {
        }

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            var identity = new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, "1")],
                SchemeName);
            var principal = new ClaimsPrincipal(identity);

            return Task.FromResult(AuthenticateResult.Success(
                new AuthenticationTicket(principal, SchemeName)));
        }
    }

    private sealed class StubLocationSearchService : IExternalLocationSearchService
    {
        public IReadOnlyList<ExternalLocation> Response { get; init; } =
        [
            new(42, "Aydın", "Aydin", "Turkey", 37.84m, 27.84m,
                "Aydın, Aydin, Turkey")
        ];

        public ExternalLocationQuery? Query { get; private set; }

        public CancellationToken CancellationToken { get; private set; }

        public Exception? Exception { get; init; }

        public Task<IReadOnlyList<ExternalLocation>> SearchAsync(
            ExternalLocationQuery query,
            CancellationToken cancellationToken = default)
        {
            Query = query;
            CancellationToken = cancellationToken;

            return Exception is null
                ? Task.FromResult(Response)
                : Task.FromException<IReadOnlyList<ExternalLocation>>(Exception);
        }
    }

    private sealed class StubWeatherService : IExternalWeatherService
    {
        public ExternalWeatherForecast Response { get; } = new(
            "Aydın",
            "Turkey",
            new DateOnly(2026, 7, 24),
            [
                new(
                    new DateOnly(2026, 7, 24),
                    20m,
                    30m,
                    25m,
                    60m,
                    20m,
                    10m,
                    "Sunny",
                    null)
            ]);

        public ExternalCoordinateForecastQuery? CoordinateQuery { get; private set; }

        public CancellationToken CancellationToken { get; private set; }

        public Exception? CoordinateException { get; init; }

        public Task<ExternalWeatherForecast> GetForecastByCoordinatesAsync(
            ExternalCoordinateForecastQuery query,
            CancellationToken cancellationToken = default)
        {
            CoordinateQuery = query;
            CancellationToken = cancellationToken;

            return CoordinateException is null
                ? Task.FromResult(Response)
                : Task.FromException<ExternalWeatherForecast>(CoordinateException);
        }

        public Task<ExternalWeatherForecast> GetForecastAsync(
            ExternalForecastQuery query,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
    }
}
