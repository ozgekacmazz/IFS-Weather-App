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
    public async Task Create_WithDailyMetrics_PersistsAndReturnsEveryValue()
    {
        var repository = new WeatherRepositoryStub();
        var service = CreateService(repository);

        var result = await service.CreateWeatherAsync(
            ValidCreateRequest(),
            TestContext.Current.CancellationToken);

        Assert.NotNull(repository.Added);
        Assert.Equal(20m, result.MinimumTemperature);
        Assert.Equal(30m, result.MaximumTemperature);
        Assert.Equal(64m, result.AverageHumidity);
        Assert.Equal(22m, result.MaximumWindSpeedKph);
        Assert.Equal(70m, result.PrecipitationProbability);
        Assert.Equal(1, repository.SaveCount);
    }

    [Fact]
    public async Task Create_WithoutDailyMetrics_PreservesLegacyNulls()
    {
        var repository = new WeatherRepositoryStub();
        var service = CreateService(repository);
        var request = ValidCreateRequest() with
        {
            MinimumTemperature = null,
            MaximumTemperature = null,
            AverageHumidity = null,
            MaximumWindSpeedKph = null,
            PrecipitationProbability = null
        };

        var result = await service.CreateWeatherAsync(
            request,
            TestContext.Current.CancellationToken);

        Assert.Null(result.MinimumTemperature);
        Assert.Null(result.MaximumTemperature);
        Assert.Null(result.AverageHumidity);
        Assert.Null(result.MaximumWindSpeedKph);
        Assert.Null(result.PrecipitationProbability);
    }

    [Theory]
    [MemberData(nameof(InvalidDailyMetricRequests))]
    public async Task Create_RejectsInvalidDailyMetrics(CreateWeatherRequest request)
    {
        var repository = new WeatherRepositoryStub();
        var service = CreateService(repository);

        await Assert.ThrowsAsync<ValidationException>(() =>
            service.CreateWeatherAsync(
                request,
                TestContext.Current.CancellationToken));

        Assert.Null(repository.Added);
        Assert.Equal(0, repository.SaveCount);
    }

    [Fact]
    public async Task Create_AcceptsNumericZeroForDailyMetrics()
    {
        var repository = new WeatherRepositoryStub();
        var service = CreateService(repository);
        var request = ValidCreateRequest() with
        {
            AverageHumidity = 0m,
            MaximumWindSpeedKph = 0m,
            PrecipitationProbability = 0m
        };

        var result = await service.CreateWeatherAsync(
            request,
            TestContext.Current.CancellationToken);

        Assert.Equal(0m, result.AverageHumidity);
        Assert.Equal(0m, result.MaximumWindSpeedKph);
        Assert.Equal(0m, result.PrecipitationProbability);
    }

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
                20m,
                30m,
                64m,
                22m,
                70m,
                "  Partly   cloudy  "),
            TestContext.Current.CancellationToken);

        Assert.Equal("İzmir City", result.CityName);
        Assert.Equal("Partly cloudy", result.MainStatus);
        Assert.Equal(20m, result.MinimumTemperature);
        Assert.Equal(30m, result.MaximumTemperature);
        Assert.Equal(64m, result.AverageHumidity);
        Assert.Equal(22m, result.MaximumWindSpeedKph);
        Assert.Equal(70m, result.PrecipitationProbability);
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
            20m,
            30m,
            64m,
            22m,
            70m,
            "Clear");

    private static CreateWeatherRequest ValidCreateRequest() =>
        new(
            new DateOnly(2026, 7, 25),
            "Izmir",
            27.25m,
            20m,
            30m,
            64m,
            22m,
            70m,
            "Clear");

    public static TheoryData<CreateWeatherRequest> InvalidDailyMetricRequests =>
        new()
        {
            ValidCreateRequest() with { MinimumTemperature = 31m },
            ValidCreateRequest() with { MaximumTemperature = 19m },
            ValidCreateRequest() with { Temperature = 31m },
            ValidCreateRequest() with { AverageHumidity = -1m },
            ValidCreateRequest() with { AverageHumidity = 101m },
            ValidCreateRequest() with { MaximumWindSpeedKph = -1m },
            ValidCreateRequest() with { PrecipitationProbability = -1m },
            ValidCreateRequest() with { PrecipitationProbability = 101m }
        };

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
        public WeatherInfo? Added { get; private set; }

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
            Task.FromResult(false);
        public Task AddAsync(WeatherInfo weatherInfo, CancellationToken cancellationToken = default)
        {
            Added = weatherInfo;
            return Task.CompletedTask;
        }
        public Task<(WeatherInfo Weather, bool Inserted)> UpsertAsync(WeatherInfo weatherInfo, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
        public void Remove(WeatherInfo weatherInfo) =>
            throw new NotSupportedException();
    }
}
