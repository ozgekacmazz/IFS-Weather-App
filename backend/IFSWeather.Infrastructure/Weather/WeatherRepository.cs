using IFSWeather.Application.Weather.Exceptions;
using IFSWeather.Application.Weather.Interfaces;
using IFSWeather.Domain.Entities;
using IFSWeather.Infrastructure.Persistence;
using IFSWeather.Infrastructure.Persistence.Configurations;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace IFSWeather.Infrastructure.Weather;

public sealed class WeatherRepository : IWeatherRepository
{
    private const string LikeEscapeCharacter = "\\";

    private readonly AppDbContext _dbContext;

    public WeatherRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<(IReadOnlyList<WeatherInfo> Items, int TotalCount)> GetPagedAsync(
        int pageNumber,
        int pageSize,
        string? city,
        DateOnly? date,
        CancellationToken cancellationToken = default)
    {
        var query = _dbContext.WeatherInfos.AsNoTracking();

        if (city is not null)
        {
            var pattern = $"%{EscapeLikePattern(city)}%";
            query = query.Where(weather => EF.Functions.ILike(
                weather.CityName,
                pattern,
                LikeEscapeCharacter));
        }

        if (date.HasValue)
        {
            query = query.Where(weather => weather.WeatherDate == date.Value);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderBy(weather => weather.WeatherDate)
            .ThenBy(weather => weather.CityName)
            .ThenBy(weather => weather.Id)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    public Task<WeatherInfo?> GetByIdAsync(
        int weatherId,
        CancellationToken cancellationToken = default)
    {
        return _dbContext.WeatherInfos
            .AsNoTracking()
            .SingleOrDefaultAsync(
                weather => weather.Id == weatherId,
                cancellationToken);
    }

    public Task<WeatherInfo?> GetTrackedByIdAsync(
        int weatherId,
        CancellationToken cancellationToken = default)
    {
        return _dbContext.WeatherInfos.SingleOrDefaultAsync(
            weather => weather.Id == weatherId,
            cancellationToken);
    }

    public Task<bool> ExistsForCityAndDateAsync(
        string cityName,
        DateOnly weatherDate,
        CancellationToken cancellationToken = default)
    {
        var pattern = EscapeLikePattern(cityName);

        return _dbContext.WeatherInfos
            .AsNoTracking()
            .AnyAsync(
                weather => weather.WeatherDate == weatherDate
                    && EF.Functions.ILike(
                        weather.CityName,
                        pattern,
                        LikeEscapeCharacter),
                cancellationToken);
    }

    public async Task AddAsync(
        WeatherInfo weatherInfo,
        CancellationToken cancellationToken = default)
    {
        await _dbContext.WeatherInfos.AddAsync(weatherInfo, cancellationToken);
    }

    public void Remove(WeatherInfo weatherInfo)
    {
        _dbContext.WeatherInfos.Remove(weatherInfo);
    }

    public async Task SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception)
            when (exception.InnerException is PostgresException
            {
                SqlState: PostgresErrorCodes.UniqueViolation,
                ConstraintName: WeatherInfoConfiguration.CityDateUniqueIndexName
            })
        {
            throw new WeatherConflictException();
        }
    }

    private static string EscapeLikePattern(string value)
    {
        return value
            .Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("%", "\\%", StringComparison.Ordinal)
            .Replace("_", "\\_", StringComparison.Ordinal);
    }
}
