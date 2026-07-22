using IFSWeather.Application.Authentication.Interfaces;
using IFSWeather.Domain.Entities;
using IFSWeather.Domain.Enums;
using IFSWeather.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace IFSWeather.Infrastructure.Authentication;

public sealed class UserRepository : IUserRepository
{
    private const string LikeEscapeCharacter = "\\";

    private readonly AppDbContext _dbContext;

    public UserRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public Task<User?> GetByIdAsync(
        int userId,
        CancellationToken cancellationToken = default)
    {
        return _dbContext.Users
            .AsNoTracking()
            .SingleOrDefaultAsync(user => user.Id == userId, cancellationToken);
    }

    public async Task<(IReadOnlyList<User> Users, int TotalCount)> GetPagedAsync(
        int pageNumber,
        int pageSize,
        string? search,
        UserStatus? status,
        CancellationToken cancellationToken = default)
    {
        var query = _dbContext.Users.AsNoTracking();

        if (search is not null)
        {
            var pattern = $"%{EscapeLikePattern(search)}%";

            query = query.Where(user =>
                EF.Functions.ILike(user.FirstName, pattern, LikeEscapeCharacter)
                || EF.Functions.ILike(user.LastName, pattern, LikeEscapeCharacter)
                || EF.Functions.ILike(user.Username, pattern, LikeEscapeCharacter)
                || EF.Functions.ILike(user.Email, pattern, LikeEscapeCharacter));
        }

        if (status.HasValue)
        {
            query = query.Where(user => user.Status == status.Value);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var users = await query
            .OrderByDescending(user => user.CreatedAt)
            .ThenByDescending(user => user.Id)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (users, totalCount);
    }

    public Task<User?> GetTrackedByIdAsync(
        int userId,
        CancellationToken cancellationToken = default)
    {
        return _dbContext.Users.SingleOrDefaultAsync(
            user => user.Id == userId,
            cancellationToken);
    }

    public async Task<TResult?> ExecuteWithUserLockAsync<TResult>(
        string value,
        Func<User, TResult> operation,
        CancellationToken cancellationToken)
        where TResult : class
    {
        var pattern = EscapeLikePattern(value);

        await using var transaction = await _dbContext.Database
            .BeginTransactionAsync(cancellationToken);

        var users = await _dbContext.Users
            .FromSqlInterpolated($"""
                SELECT *
                FROM "USER_TAB"
                WHERE "Username" ILIKE {pattern} ESCAPE '\'
                   OR "Email" ILIKE {pattern} ESCAPE '\'
                FOR UPDATE
                """)
            .ToListAsync(cancellationToken);

        var user = users.SingleOrDefault();

        if (user is null)
        {
            await transaction.CommitAsync(cancellationToken);
            return null;
        }

        var result = operation(user);

        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return result;
    }

    public Task<bool> UsernameExistsAsync(
        string username,
        CancellationToken cancellationToken)
    {
        var pattern = EscapeLikePattern(username);

        return _dbContext.Users.AnyAsync(
            user => EF.Functions.ILike(
                user.Username,
                pattern,
                LikeEscapeCharacter),
            cancellationToken);
    }

    public Task<bool> EmailExistsAsync(
        string email,
        CancellationToken cancellationToken)
    {
        var pattern = EscapeLikePattern(email);

        return _dbContext.Users.AnyAsync(
            user => EF.Functions.ILike(
                user.Email,
                pattern,
                LikeEscapeCharacter),
            cancellationToken);
    }

    public async Task AddAsync(User user, CancellationToken cancellationToken)
    {
        await _dbContext.Users.AddAsync(user, cancellationToken);
    }

    public async Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private static string EscapeLikePattern(string value)
    {
        return value
            .Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("%", "\\%", StringComparison.Ordinal)
            .Replace("_", "\\_", StringComparison.Ordinal);
    }
}
