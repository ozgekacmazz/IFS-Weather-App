using IFSWeather.Application.Authentication.Interfaces;
using IFSWeather.Application.Common.Interfaces;
using IFSWeather.Application.Weather.Interfaces;
using IFSWeather.Application.Weather.Models;
using IFSWeather.Application.Weather.Services;
using IFSWeather.Application.Weather.Validators;
using IFSWeather.Domain.Entities;
using IFSWeather.Domain.Enums;
using Xunit;

namespace IFSWeather.Tests.Weather;

public sealed class UserWeatherServiceTests
{
    [Fact]
    public async Task GetCurrentWeatherAsync_UsesCurrentUtcDateAndNormalizedDefaultCity()
    {
        var currentDate = new DateOnly(2026, 7, 24);
        var fixture = CreateFixture(
            currentDate,
            "  New   York ",
            [
                CreateWeatherInfo(1, currentDate.AddDays(-1), "New York", 20m),
                CreateWeatherInfo(2, currentDate, "new york", 22m)
            ]);

        var response = await fixture.Service.GetCurrentWeatherAsync(
            new CurrentWeatherQuery(),
            TestContext.Current.CancellationToken);

        Assert.Equal("New York", fixture.WeatherRepository.RequestedCity);
        Assert.Equal(currentDate, fixture.WeatherRepository.RequestedDate);
        Assert.Equal(2, response.WeatherId);
        Assert.Equal(currentDate, response.WeatherDate);
    }

    [Theory]
    [InlineData("2026-07-20", "2026-07-20")]
    [InlineData("2026-07-22", "2026-07-20")]
    [InlineData("2026-07-26", "2026-07-20")]
    [InlineData("2026-08-01", "2026-07-27")]
    [InlineData("2027-01-01", "2026-12-28")]
    [InlineData("2024-02-29", "2024-02-26")]
    public async Task GetForecastAsync_UsesContainingMondayThroughSunday(
        string currentDateValue,
        string expectedMondayValue)
    {
        var currentDate = DateOnly.Parse(currentDateValue);
        var expectedMonday = DateOnly.Parse(expectedMondayValue);
        var fixture = CreateFixture(currentDate);

        var response = await fixture.Service.GetForecastAsync(
            TestContext.Current.CancellationToken);

        Assert.Equal(expectedMonday, fixture.WeatherRepository.RequestedStartDate);
        Assert.Equal(expectedMonday.AddDays(6), fixture.WeatherRepository.RequestedEndDate);
        Assert.Equal(expectedMonday, response.StartDate);
        Assert.Equal(7, response.RequestedDays);
    }

    [Fact]
    public async Task GetForecastAsync_UsesNormalizedDefaultCityAndReturnsOnlyAvailableWeekRecords()
    {
        var monday = new DateOnly(2026, 7, 20);
        var weatherInfos = new[]
        {
            CreateWeatherInfo(1, monday.AddDays(-1), "New York", 18m),
            CreateWeatherInfo(2, monday.AddDays(4), "New York", 24m),
            CreateWeatherInfo(3, monday.AddDays(1), "London", 21m),
            CreateWeatherInfo(4, monday.AddDays(1), "new york", 20m),
            CreateWeatherInfo(5, monday.AddDays(7), "New York", 25m)
        };
        var fixture = CreateFixture(
            new DateOnly(2026, 7, 22),
            "  New   York ",
            weatherInfos);

        var response = await fixture.Service.GetForecastAsync(
            TestContext.Current.CancellationToken);

        Assert.Equal("New York", fixture.WeatherRepository.RequestedCity);
        Assert.Equal("New York", response.CityName);
        Assert.Collection(
            response.Items,
            item =>
            {
                Assert.Equal(4, item.WeatherId);
                Assert.Equal(monday.AddDays(1), item.WeatherDate);
                Assert.Equal(20m, item.Temperature);
            },
            item =>
            {
                Assert.Equal(2, item.WeatherId);
                Assert.Equal(monday.AddDays(4), item.WeatherDate);
                Assert.Equal(24m, item.Temperature);
            });
    }

    private static TestFixture CreateFixture(
        DateOnly currentDate,
        string defaultCity = "Istanbul",
        IEnumerable<WeatherInfo>? weatherInfos = null)
    {
        var user = new User
        {
            Id = 7,
            FirstName = "Test",
            LastName = "User",
            Username = "test-user",
            Email = "test@example.com",
            PasswordHash = "hash",
            DefaultCity = defaultCity,
            Role = UserRole.User,
            Status = UserStatus.Active
        };
        var currentUserService = new StubCurrentUserService(user.Id);
        var userRepository = new StubUserRepository(user);
        var weatherRepository = new InMemoryWeatherRepository(
            weatherInfos ?? Array.Empty<WeatherInfo>());
        var timeProvider = new StubTimeProvider(
            new DateTimeOffset(
                currentDate.Year,
                currentDate.Month,
                currentDate.Day,
                12,
                0,
                0,
                TimeSpan.Zero));
        var service = new UserWeatherService(
            currentUserService,
            userRepository,
            weatherRepository,
            new CurrentWeatherQueryValidator(),
            timeProvider);

        return new TestFixture(service, weatherRepository);
    }

    private static WeatherInfo CreateWeatherInfo(
        int id,
        DateOnly weatherDate,
        string city,
        decimal temperature)
    {
        return new WeatherInfo
        {
            Id = id,
            WeatherDate = weatherDate,
            CityName = city,
            Temperature = temperature,
            MainStatus = "Clear",
            CreatedAt = DateTime.UnixEpoch,
            UpdatedAt = DateTime.UnixEpoch
        };
    }

    private sealed record TestFixture(
        UserWeatherService Service,
        InMemoryWeatherRepository WeatherRepository);

    private sealed class StubTimeProvider : TimeProvider
    {
        private readonly DateTimeOffset _utcNow;

        public StubTimeProvider(DateTimeOffset utcNow)
        {
            _utcNow = utcNow;
        }

        public override DateTimeOffset GetUtcNow() => _utcNow;
    }

    private sealed class StubCurrentUserService : ICurrentUserService
    {
        public StubCurrentUserService(int userId)
        {
            UserId = userId;
        }

        public int? UserId { get; }

        public bool IsAuthenticated => true;
    }

    private sealed class StubUserRepository : IUserRepository
    {
        private readonly User _user;

        public StubUserRepository(User user)
        {
            _user = user;
        }

        public Task<User?> GetByIdAsync(
            int userId,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult<User?>(userId == _user.Id ? _user : null);
        }

        public Task<(IReadOnlyList<User> Users, int TotalCount)> GetPagedAsync(
            int pageNumber,
            int pageSize,
            string? search,
            UserStatus? status,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<User?> GetTrackedByIdAsync(
            int userId,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<TResult?> ExecuteWithUserLockAsync<TResult>(
            string value,
            Func<User, TResult> operation,
            CancellationToken cancellationToken)
            where TResult : class =>
            throw new NotSupportedException();

        public Task<bool> UsernameExistsAsync(
            string username,
            CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<bool> EmailExistsAsync(
            string email,
            CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task AddAsync(User user, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task SaveChangesAsync(CancellationToken cancellationToken) =>
            throw new NotSupportedException();
    }

    private sealed class InMemoryWeatherRepository : IWeatherRepository
    {
        private readonly IReadOnlyList<WeatherInfo> _weatherInfos;

        public InMemoryWeatherRepository(IEnumerable<WeatherInfo> weatherInfos)
        {
            _weatherInfos = weatherInfos.ToArray();
        }

        public string? RequestedCity { get; private set; }

        public DateOnly? RequestedStartDate { get; private set; }

        public DateOnly? RequestedEndDate { get; private set; }

        public DateOnly? RequestedDate { get; private set; }

        public Task<IReadOnlyList<WeatherInfo>> GetByCityAndDateRangeAsync(
            string cityName,
            DateOnly startDate,
            DateOnly endDate,
            CancellationToken cancellationToken = default)
        {
            RequestedCity = cityName;
            RequestedStartDate = startDate;
            RequestedEndDate = endDate;

            IReadOnlyList<WeatherInfo> result = _weatherInfos
                .Where(weather => weather.WeatherDate >= startDate
                    && weather.WeatherDate <= endDate
                    && string.Equals(
                        weather.CityName,
                        cityName,
                        StringComparison.OrdinalIgnoreCase))
                .OrderBy(weather => weather.WeatherDate)
                .ThenBy(weather => weather.Id)
                .ToArray();

            return Task.FromResult(result);
        }

        public Task<(IReadOnlyList<WeatherInfo> Items, int TotalCount)> GetPagedAsync(
            int pageNumber,
            int pageSize,
            string? city,
            DateOnly? date,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<WeatherInfo?> GetByIdAsync(
            int weatherId,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<WeatherInfo?> GetTrackedByIdAsync(
            int weatherId,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<WeatherInfo?> GetByCityAndDateAsync(
            string cityName,
            DateOnly date,
            CancellationToken cancellationToken = default)
        {
            RequestedCity = cityName;
            RequestedDate = date;

            var result = _weatherInfos.SingleOrDefault(weather =>
                weather.WeatherDate == date
                && string.Equals(
                    weather.CityName,
                    cityName,
                    StringComparison.OrdinalIgnoreCase));

            return Task.FromResult(result);
        }

        public Task<bool> ExistsForCityAndDateAsync(
            string cityName,
            DateOnly weatherDate,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task AddAsync(
            WeatherInfo weatherInfo,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public void Remove(WeatherInfo weatherInfo) =>
            throw new NotSupportedException();

        public Task SaveChangesAsync(
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
    }
}
