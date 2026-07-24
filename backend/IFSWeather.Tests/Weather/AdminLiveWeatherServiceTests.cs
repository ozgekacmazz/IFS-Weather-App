using FluentValidation;
using IFSWeather.Api.Controllers;
using IFSWeather.Application.Weather.DTOs;
using IFSWeather.Application.Weather.External.Interfaces;
using IFSWeather.Application.Weather.External.Models;
using IFSWeather.Application.Weather.Interfaces;
using IFSWeather.Application.Weather.Services;
using IFSWeather.Application.Weather.Validators;
using IFSWeather.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Xunit;

namespace IFSWeather.Tests.Weather;

public sealed class AdminLiveWeatherServiceTests
{
    private static readonly DateTime TestNow = new(
        2026, 7, 24, 8, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task Preview_UsesCoordinatesWithoutPersistingAndPreservesLabel()
    {
        var fixture = CreateFixture();

        var result = await fixture.Service.PreviewAsync(new(
            38.423734m,
            27.142826m,
            " İzmir ",
            " İzmir, Türkiye "),
            TestContext.Current.CancellationToken);

        Assert.Equal("İzmir", result.CityName);
        Assert.Equal("İzmir, Türkiye", result.DisplayLabel);
        Assert.Equal("Basmahane", fixture.External.Response.CityName);
        Assert.Equal(38.423734m, fixture.External.Query!.Latitude);
        Assert.Equal(27.142826m, fixture.External.Query.Longitude);
        Assert.Equal(1, fixture.External.Query.Days);
        Assert.Equal(0, fixture.Repository.UpsertCount);
    }

    [Theory]
    [InlineData(-91, 20)]
    [InlineData(20, 181)]
    public async Task Preview_RejectsInvalidCoordinates(
        decimal latitude,
        decimal longitude)
    {
        var fixture = CreateFixture();

        await Assert.ThrowsAsync<ValidationException>(() =>
            fixture.Service.PreviewAsync(new(
                latitude,
                longitude,
                "İzmir",
                "İzmir, Türkiye"),
                TestContext.Current.CancellationToken));

        Assert.Null(fixture.External.Query);
        Assert.Equal(0, fixture.Repository.UpsertCount);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Save_AtomicallyUpsertsAndReportsInsertOrUpdate(bool inserted)
    {
        var fixture = CreateFixture(inserted);

        var result = await fixture.Service.SaveAsync(new(
            new DateOnly(2026, 7, 24),
            " Diyarbakir ",
            "Diyarbakir, Turkey",
            37.91441m,
            40.23063m,
            31.25m,
            " Sunny "),
            TestContext.Current.CancellationToken);

        Assert.Equal(inserted, result.Inserted);
        Assert.Equal(1, fixture.Repository.UpsertCount);
        Assert.Equal("Diyarbakir", fixture.Repository.Upserted!.CityName);
        Assert.Equal("Sunny", fixture.Repository.Upserted.MainStatus);
        Assert.Equal(TestNow, fixture.Repository.Upserted.UpdatedAt);
    }

    [Fact]
    public async Task Save_RejectsInvalidPreviewWithoutPersistence()
    {
        var fixture = CreateFixture();

        await Assert.ThrowsAsync<ValidationException>(() =>
            fixture.Service.SaveAsync(new(
                default,
                "x",
                "",
                0,
                0,
                100,
                ""),
                TestContext.Current.CancellationToken));

        Assert.Equal(0, fixture.Repository.UpsertCount);
    }

    [Fact]
    public void AdminController_RequiresAdminRole()
    {
        var attribute = Assert.Single(
            typeof(AdminWeatherController)
                .GetCustomAttributes(typeof(AuthorizeAttribute), true)
                .Cast<AuthorizeAttribute>());

        Assert.Equal("Admin", attribute.Roles);
    }

    private static Fixture CreateFixture(bool inserted = true)
    {
        var external = new ExternalServiceStub();
        var repository = new WeatherRepositoryStub(inserted);
        var service = new AdminLiveWeatherService(
            external,
            repository,
            new AdminWeatherPreviewRequestValidator(),
            new SaveWeatherPreviewRequestValidator(),
            new FixedTimeProvider(TestNow));
        return new Fixture(service, external, repository);
    }

    private sealed record Fixture(
        AdminLiveWeatherService Service,
        ExternalServiceStub External,
        WeatherRepositoryStub Repository);

    private sealed class FixedTimeProvider(DateTime utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => new(utcNow);
    }

    private sealed class ExternalServiceStub : IExternalWeatherService
    {
        public ExternalCoordinateForecastQuery? Query { get; private set; }

        public ExternalWeatherForecast Response { get; } = new(
            "Basmahane",
            "Türkiye",
            new DateOnly(2026, 7, 24),
            [
                new(
                    new DateOnly(2026, 7, 24),
                    20,
                    32,
                    26,
                    "Sunny",
                    null)
            ]);

        public Task<ExternalWeatherForecast> GetForecastByCoordinatesAsync(
            ExternalCoordinateForecastQuery query,
            CancellationToken cancellationToken = default)
        {
            Query = query;
            return Task.FromResult(Response);
        }

        public Task<ExternalWeatherForecast> GetForecastAsync(
            ExternalForecastQuery query,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
    }

    private sealed class WeatherRepositoryStub(bool inserted) : IWeatherRepository
    {
        public int UpsertCount { get; private set; }
        public WeatherInfo? Upserted { get; private set; }

        public Task<(WeatherInfo Weather, bool Inserted)> UpsertAsync(
            WeatherInfo weatherInfo,
            CancellationToken cancellationToken = default)
        {
            UpsertCount++;
            Upserted = weatherInfo;
            weatherInfo.Id = 42;
            return Task.FromResult((weatherInfo, inserted));
        }

        public Task<(IReadOnlyList<WeatherInfo> Items, int TotalCount)> GetPagedAsync(
            int pageNumber, int pageSize, string? city, DateOnly? date,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
        public Task<WeatherInfo?> GetByIdAsync(int weatherId, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
        public Task<WeatherInfo?> GetTrackedByIdAsync(int weatherId, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
        public Task<WeatherInfo?> GetByCityAndDateAsync(string cityName, DateOnly date, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
        public Task<IReadOnlyList<WeatherInfo>> GetByCityAndDateRangeAsync(string cityName, DateOnly startDate, DateOnly endDate, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
        public Task<bool> ExistsForCityAndDateAsync(string cityName, DateOnly weatherDate, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
        public Task AddAsync(WeatherInfo weatherInfo, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
        public void Remove(WeatherInfo weatherInfo) => throw new NotSupportedException();
        public Task SaveChangesAsync(CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
    }
}
