using IFSWeather.Domain.Entities;

namespace IFSWeather.Application.Weather.Interfaces;

public interface IWeatherRepository
{
    Task<(IReadOnlyList<WeatherInfo> Items, int TotalCount)> GetPagedAsync(
        int pageNumber,
        int pageSize,
        string? city,
        DateOnly? date,
        CancellationToken cancellationToken = default);

    Task<WeatherInfo?> GetByIdAsync(
        int weatherId,
        CancellationToken cancellationToken = default);

    Task<WeatherInfo?> GetTrackedByIdAsync(
        int weatherId,
        CancellationToken cancellationToken = default);

    Task<WeatherInfo?> GetByCityAndDateAsync(
        string cityName,
        DateOnly date,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<WeatherInfo>> GetByCityAndDateRangeAsync(
        string cityName,
        DateOnly startDate,
        DateOnly endDate,
        CancellationToken cancellationToken = default);

    Task<bool> ExistsForCityAndDateAsync(
        string cityName,
        DateOnly weatherDate,
        CancellationToken cancellationToken = default);

    Task<bool> ExistsForCityAndDateExceptAsync(
        string cityName,
        DateOnly weatherDate,
        int excludedWeatherId,
        CancellationToken cancellationToken = default);

    Task AddAsync(
        WeatherInfo weatherInfo,
        CancellationToken cancellationToken = default);

    Task<(WeatherInfo Weather, bool Inserted)> UpsertAsync(
        WeatherInfo weatherInfo,
        CancellationToken cancellationToken = default);

    void Remove(WeatherInfo weatherInfo);

    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
