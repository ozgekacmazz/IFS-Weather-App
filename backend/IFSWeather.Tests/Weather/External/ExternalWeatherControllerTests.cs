using System.Reflection;
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
        public Task<ExternalWeatherForecast> GetForecastAsync(
            ExternalForecastQuery query,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
    }
}
