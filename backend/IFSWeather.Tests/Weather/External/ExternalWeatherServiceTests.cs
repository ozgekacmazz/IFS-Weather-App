using FluentValidation;
using IFSWeather.Application.Weather.External.Interfaces;
using IFSWeather.Application.Weather.External.Models;
using IFSWeather.Application.Weather.External.Services;
using IFSWeather.Application.Weather.External.Validators;
using Xunit;

namespace IFSWeather.Tests.Weather.External;

public sealed class ExternalWeatherServiceTests
{
    [Fact]
    public async Task GetForecastAsync_NormalizesCityAndPropagatesRequest()
    {
        var provider = new RecordingProvider();
        var service = CreateService(provider);
        using var cancellation = new CancellationTokenSource();

        var result = await service.GetForecastAsync(
            new ExternalForecastQuery { City = "  New\t  York  ", Days = 2 },
            cancellation.Token);

        Assert.Equal("New York", provider.City);
        Assert.Equal(2, provider.Days);
        Assert.Equal(cancellation.Token, provider.CancellationToken);
        Assert.Same(provider.Response, result);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    public async Task GetForecastAsync_AcceptsSupportedDayBoundaries(int days)
    {
        var provider = new RecordingProvider();
        var service = CreateService(provider);

        await service.GetForecastAsync(
            new ExternalForecastQuery { City = "Ankara", Days = days },
            TestContext.Current.CancellationToken);

        Assert.Equal(days, provider.Days);
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("A")]
    public async Task GetForecastAsync_RejectsInvalidCityBeforeProvider(string city)
    {
        var provider = new RecordingProvider();
        var service = CreateService(provider);
        var query = new ExternalForecastQuery
        {
            City = city,
            Days = 3
        };

        await Assert.ThrowsAsync<ValidationException>(() =>
            service.GetForecastAsync(query, TestContext.Current.CancellationToken));

        Assert.Null(provider.City);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(4)]
    public async Task GetForecastAsync_RejectsInvalidDaysBeforeProvider(int days)
    {
        var provider = new RecordingProvider();
        var service = CreateService(provider);

        await Assert.ThrowsAsync<ValidationException>(() =>
            service.GetForecastAsync(
                new ExternalForecastQuery { City = "Ankara", Days = days },
                TestContext.Current.CancellationToken));

        Assert.Null(provider.City);
    }

    private static ExternalWeatherService CreateService(
        IExternalWeatherProvider provider) =>
        new(provider, new ExternalForecastQueryValidator());

    private sealed class RecordingProvider : IExternalWeatherProvider
    {
        public ExternalWeatherForecast Response { get; } = new(
            "New York",
            "United States of America",
            new DateOnly(2026, 7, 23),
            [
                new(
                    new DateOnly(2026, 7, 23),
                    20m,
                    30m,
                    25m,
                    "Sunny",
                    null)
            ]);

        public string? City { get; private set; }

        public int Days { get; private set; }

        public CancellationToken CancellationToken { get; private set; }

        public Task<IReadOnlyList<ExternalLocation>> SearchLocationsAsync(
            string query,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<ExternalWeatherForecast> GetForecastAsync(
            string city,
            int days,
            CancellationToken cancellationToken = default)
        {
            City = city;
            Days = days;
            CancellationToken = cancellationToken;
            return Task.FromResult(Response);
        }
    }
}
