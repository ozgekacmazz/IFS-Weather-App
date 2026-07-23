using System.Reflection;
using System.Globalization;
using FluentValidation;
using FluentValidation.Results;
using IFSWeather.Api.Controllers;
using IFSWeather.Application.Weather.External.Interfaces;
using IFSWeather.Application.Weather.External.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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
        var query = new ExternalLocationQuery { Query = "Aydın" };
        using var cancellation = new CancellationTokenSource();

        var result = await controller.SearchLocations(query, cancellation.Token);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Same(locationSearchService.Response, ok.Value);
        Assert.Same(query, locationSearchService.Query);
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
                new ExternalLocationQuery { Query = " " },
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
            new ExternalLocationQuery { Query = "Missing" },
            TestContext.Current.CancellationToken);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var locations = Assert.IsAssignableFrom<IReadOnlyList<ExternalLocation>>(ok.Value);
        Assert.Empty(locations);
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
