using IFSWeather.Application.Weather.Exceptions;
using IFSWeather.Application.Weather.Interfaces;
using IFSWeather.Domain.Entities;
using IFSWeather.Infrastructure.Persistence;
using IFSWeather.Infrastructure.Persistence.Configurations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
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

    public Task<WeatherInfo?> GetByCityAndDateAsync(
        string cityName,
        DateOnly date,
        CancellationToken cancellationToken = default)
    {
        var pattern = EscapeLikePattern(cityName);

        return _dbContext.WeatherInfos
            .AsNoTracking()
            .SingleOrDefaultAsync(
                weather => weather.WeatherDate == date
                    && EF.Functions.ILike(
                        weather.CityName,
                        pattern,
                        LikeEscapeCharacter),
                cancellationToken);
    }

    public async Task<IReadOnlyList<WeatherInfo>> GetByCityAndDateRangeAsync(
        string cityName,
        DateOnly startDate,
        DateOnly endDate,
        CancellationToken cancellationToken = default)
    {
        var pattern = EscapeLikePattern(cityName);

        return await _dbContext.WeatherInfos
            .AsNoTracking()
            .Where(weather => weather.WeatherDate >= startDate
                && weather.WeatherDate <= endDate
                && EF.Functions.ILike(
                    weather.CityName,
                    pattern,
                    LikeEscapeCharacter))
            .OrderBy(weather => weather.WeatherDate)
            .ThenBy(weather => weather.Id)
            .ToListAsync(cancellationToken);
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

    public Task<bool> ExistsForCityAndDateExceptAsync(
        string cityName,
        DateOnly weatherDate,
        int excludedWeatherId,
        CancellationToken cancellationToken = default)
    {
        var pattern = EscapeLikePattern(cityName);

        return _dbContext.WeatherInfos
            .AsNoTracking()
            .AnyAsync(
                weather => weather.Id != excludedWeatherId
                    && weather.WeatherDate == weatherDate
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

    public async Task<(WeatherInfo Weather, bool Inserted)> UpsertAsync(
        WeatherInfo weatherInfo,
        CancellationToken cancellationToken = default)
    {
        await using var transaction = await _dbContext.Database
            .BeginTransactionAsync(cancellationToken);
        var connection = (NpgsqlConnection)_dbContext.Database.GetDbConnection();
        await using var command = new NpgsqlCommand("""
            INSERT INTO "Weather_Info_Tab"
                ("WeatherDate", "CityName", "Temperature", "MainStatus",
                 "CreatedAt", "UpdatedAt")
            VALUES
                (@weatherDate, @cityName, @temperature, @mainStatus,
                 @createdAt, @updatedAt)
            ON CONFLICT ("WeatherDate", "NormalizedCityName")
            DO UPDATE SET
                "CityName" = EXCLUDED."CityName",
                "Temperature" = EXCLUDED."Temperature",
                "MainStatus" = EXCLUDED."MainStatus",
                "UpdatedAt" = EXCLUDED."UpdatedAt"
            RETURNING "Id", "WeatherDate", "CityName", "Temperature",
                      "MainStatus", "CreatedAt", "UpdatedAt", (xmax = 0)
            """, connection, (NpgsqlTransaction)transaction.GetDbTransaction());
        command.Parameters.AddWithValue("weatherDate", weatherInfo.WeatherDate);
        command.Parameters.AddWithValue("cityName", weatherInfo.CityName);
        command.Parameters.AddWithValue("temperature", weatherInfo.Temperature);
        command.Parameters.AddWithValue("mainStatus", weatherInfo.MainStatus);
        command.Parameters.AddWithValue("createdAt", weatherInfo.CreatedAt);
        command.Parameters.AddWithValue("updatedAt", weatherInfo.UpdatedAt);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            throw new InvalidOperationException("Weather upsert returned no record.");
        }

        var saved = new WeatherInfo
        {
            Id = reader.GetInt32(0),
            WeatherDate = reader.GetFieldValue<DateOnly>(1),
            CityName = reader.GetString(2),
            Temperature = reader.GetDecimal(3),
            MainStatus = reader.GetString(4),
            CreatedAt = reader.GetDateTime(5),
            UpdatedAt = reader.GetDateTime(6)
        };
        var inserted = reader.GetBoolean(7);
        await reader.CloseAsync();
        await transaction.CommitAsync(cancellationToken);
        return (saved, inserted);
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
