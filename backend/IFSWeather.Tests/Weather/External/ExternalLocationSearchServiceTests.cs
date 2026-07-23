using FluentValidation;
using IFSWeather.Application.Weather.External.Interfaces;
using IFSWeather.Application.Weather.External.Models;
using IFSWeather.Application.Weather.External.Services;
using IFSWeather.Application.Weather.External.Validators;
using Xunit;

namespace IFSWeather.Tests.Weather.External;

public sealed class ExternalLocationSearchServiceTests
{
    [Fact]
    public async Task SearchAsync_TrimsQueryAndPropagatesRequest()
    {
        var provider = new RecordingProvider();
        var service = CreateService(provider);
        using var cancellation = new CancellationTokenSource();

        var result = await service.SearchAsync(
            new ExternalLocationQuery { Query = "  Aydın  " },
            cancellation.Token);

        Assert.Equal("Aydın", provider.Query);
        Assert.Equal(cancellation.Token, provider.CancellationToken);
        Assert.Same(provider.SearchResponse, result);
    }

    [Theory]
    [InlineData("Aydın")]
    [InlineData("İzmir")]
    [InlineData("Şanlıurfa")]
    [InlineData("Çanakkale")]
    [InlineData("Eskişehir")]
    [InlineData("München")]
    [InlineData("São Paulo")]
    [InlineData("Kraków")]
    public async Task SearchAsync_PreservesUnicodeQuery(string query)
    {
        var provider = new RecordingProvider();
        var service = CreateService(provider);

        await service.SearchAsync(
            new ExternalLocationQuery { Query = query },
            TestContext.Current.CancellationToken);

        Assert.Equal(query, provider.Query);
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    public async Task SearchAsync_RejectsBlankQueryBeforeProvider(string query)
    {
        var provider = new RecordingProvider();
        var service = CreateService(provider);

        await Assert.ThrowsAsync<ValidationException>(() =>
            service.SearchAsync(
                new ExternalLocationQuery { Query = query },
                TestContext.Current.CancellationToken));

        Assert.Null(provider.Query);
    }

    [Fact]
    public async Task SearchAsync_RejectsOverLimitQueryBeforeProvider()
    {
        var provider = new RecordingProvider();
        var service = CreateService(provider);
        var query = new string('a', ExternalLocationQueryValidator.MaximumQueryLength + 1);

        await Assert.ThrowsAsync<ValidationException>(() =>
            service.SearchAsync(
                new ExternalLocationQuery { Query = query },
                TestContext.Current.CancellationToken));

        Assert.Null(provider.Query);
    }

    [Fact]
    public async Task SearchAsync_ReturnsEmptyProviderResult()
    {
        var provider = new RecordingProvider
        {
            SearchResponse = []
        };
        var service = CreateService(provider);

        var result = await service.SearchAsync(
            new ExternalLocationQuery { Query = "Missing" },
            TestContext.Current.CancellationToken);

        Assert.Empty(result);
    }

    private static ExternalLocationSearchService CreateService(
        IExternalWeatherProvider provider) =>
        new(provider, new ExternalLocationQueryValidator());

    private sealed class RecordingProvider : IExternalWeatherProvider
    {
        public IReadOnlyList<ExternalLocation> SearchResponse { get; set; } =
        [
            new(42, "Aydın", "Aydin", "Turkey", 37.84m, 27.84m,
                "Aydın, Aydin, Turkey")
        ];

        public string? Query { get; private set; }

        public CancellationToken CancellationToken { get; private set; }

        public Task<IReadOnlyList<ExternalLocation>> SearchLocationsAsync(
            string query,
            CancellationToken cancellationToken = default)
        {
            Query = query;
            CancellationToken = cancellationToken;
            return Task.FromResult(SearchResponse);
        }

        public Task<ExternalWeatherForecast> GetForecastAsync(
            string city,
            int days,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<ExternalWeatherForecast> GetForecastByCoordinatesAsync(
            decimal latitude,
            decimal longitude,
            int days,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
    }
}
