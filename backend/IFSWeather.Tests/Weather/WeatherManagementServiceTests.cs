using FluentValidation;
using IFSWeather.Application.Weather.DTOs;
using IFSWeather.Application.Weather.Exceptions;
using IFSWeather.Application.Weather.Interfaces;
using IFSWeather.Application.Weather.Models;
using IFSWeather.Application.Weather.Services;
using IFSWeather.Application.Weather.Validators;
using IFSWeather.Domain.Entities;
using Xunit;

namespace IFSWeather.Tests.Weather;

public sealed class WeatherManagementServiceTests
{
    private static readonly DateTime CreatedAt = new(
        2026, 7, 20, 8, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime UpdatedAt = new(
        2026, 7, 25, 9, 30, 0, DateTimeKind.Utc);

    [Fact]
    public async Task Update_NormalizesFieldsAndPreservesCreatedAt()
    {
        var repository = new WeatherRepositoryStub
        {
            Tracked = ExistingWeather()
        };
        var service = CreateService(repository);

        var result = await service.UpdateWeatherAsync(
            42,
            new(
                new DateOnly(2026, 7, 25),
                "  İzmir   City  ",
                27.25m,
                "  Partly   cloudy  "),
            TestContext.Current.CancellationToken);

        Assert.Equal("İzmir City", result.CityName);
        Assert.Equal("Partly cloudy", result.MainStatus);
        Assert.Equal(CreatedAt, result.CreatedAt);
        Assert.Equal(UpdatedAt, result.UpdatedAt);
        Assert.Equal(CreatedAt, repository.Tracked!.CreatedAt);
        Assert.Equal(1, repository.SaveCount);
        Assert.Equal(42, repository.ExcludedWeatherId);
    }

    [Fact]
    public async Task Update_ThrowsNotFoundWithoutSaving()
    {
        var repository = new WeatherRepositoryStub();
        var service = CreateService(repository);

        await Assert.ThrowsAsync<WeatherNotFoundException>(() =>
            service.UpdateWeatherAsync(
                404,
                ValidRequest(),
                TestContext.Current.CancellationToken));

        Assert.Equal(0, repository.SaveCount);
    }

    [Fact]
    public async Task Update_ThrowsConflictWithoutChangingExistingRecord()
    {
        var original = ExistingWeather();
        var repository = new WeatherRepositoryStub
        {
            Tracked = original,
            ConflictExists = true
        };
        var service = CreateService(repository);

        await Assert.ThrowsAsync<WeatherConflictException>(() =>
            service.UpdateWeatherAsync(
                original.Id,
                ValidRequest() with { CityName = "Aydın" },
                TestContext.Current.CancellationToken));

        Assert.Equal("Denizli", original.CityName);
        Assert.Equal(CreatedAt, original.CreatedAt);
        Assert.Equal(0, repository.SaveCount);
    }

    [Fact]
    public async Task Update_RejectsInvalidRequestBeforeLoadingRecord()
    {
        var repository = new WeatherRepositoryStub
        {
            Tracked = ExistingWeather()
        };
        var service = CreateService(repository);

        await Assert.ThrowsAsync<ValidationException>(() =>
            service.UpdateWeatherAsync(
                42,
                ValidRequest() with { Temperature = 61m },
                TestContext.Current.CancellationToken));

        Assert.Equal(0, repository.TrackedReadCount);
        Assert.Equal(0, repository.SaveCount);
    }

    private static WeatherManagementService CreateService(
        WeatherRepositoryStub repository) =>
        new(
            repository,
            new CreateWeatherRequestValidator(),
            new UpdateWeatherRequestValidator(),
            new WeatherQueryValidator(),
            new FixedTimeProvider(UpdatedAt));

    private static UpdateWeatherRequest ValidRequest() =>
        new(
            new DateOnly(2026, 7, 25),
            "İzmir",
            27.25m,
            "Clear");

    private static WeatherInfo ExistingWeather() =>
        new()
        {
            Id = 42,
            WeatherDate = new DateOnly(2026, 7, 24),
            CityName = "Denizli",
            Temperature = 32m,
            MainStatus = "Sunny",
            CreatedAt = CreatedAt,
            UpdatedAt = CreatedAt
        };

    private sealed class FixedTimeProvider(DateTime utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => new(utcNow);
    }

    private sealed class WeatherRepositoryStub : IWeatherRepository
    {
        public WeatherInfo? Tracked { get; init; }
        public bool ConflictExists { get; init; }
        public int TrackedReadCount { get; private set; }
        public int SaveCount { get; private set; }
        public int? ExcludedWeatherId { get; private set; }

        public Task<WeatherInfo?> GetTrackedByIdAsync(
            int weatherId,
            CancellationToken cancellationToken = default)
        {
            TrackedReadCount++;
            return Task.FromResult(
                Tracked?.Id == weatherId ? Tracked : null);
        }

        public Task<bool> ExistsForCityAndDateExceptAsync(
            string cityName,
            DateOnly weatherDate,
            int excludedWeatherId,
            CancellationToken cancellationToken = default)
        {
            ExcludedWeatherId = excludedWeatherId;
            return Task.FromResult(ConflictExists);
        }

        public Task SaveChangesAsync(
            CancellationToken cancellationToken = default)
        {
            SaveCount++;
            return Task.CompletedTask;
        }

        public Task<(IReadOnlyList<WeatherInfo> Items, int TotalCount)> GetPagedAsync(
            int pageNumber, int pageSize, string? city, DateOnly? date,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
        public Task<WeatherInfo?> GetByIdAsync(int weatherId, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
        public Task<WeatherInfo?> GetByCityAndDateAsync(string cityName, DateOnly date, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
        public Task<IReadOnlyList<WeatherInfo>> GetByCityAndDateRangeAsync(string cityName, DateOnly startDate, DateOnly endDate, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
        public Task<bool> ExistsForCityAndDateAsync(string cityName, DateOnly weatherDate, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
        public Task AddAsync(WeatherInfo weatherInfo, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
        public Task<(WeatherInfo Weather, bool Inserted)> UpsertAsync(WeatherInfo weatherInfo, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
        public void Remove(WeatherInfo weatherInfo) =>
            throw new NotSupportedException();
    }
}
