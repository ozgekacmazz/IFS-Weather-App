using IFSWeather.Application.AdminBootstrap.Exceptions;
using IFSWeather.Application.AdminBootstrap.Interfaces;
using IFSWeather.Application.AdminBootstrap.Models;
using IFSWeather.Domain.Entities;
using IFSWeather.Domain.Enums;
using IFSWeather.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace IFSWeather.Infrastructure.Authentication;

public sealed class AdminBootstrapRepository : IAdminBootstrapRepository
{
    internal const string UsernameUniqueConstraintName = "IX_USER_TAB_Username";
    internal const string EmailUniqueConstraintName = "IX_USER_TAB_Email";

    private const long AdvisoryLockKey = 4_946_625_736_669_824_833;
    private const string LikeEscapeCharacter = "\\";

    private readonly AppDbContext _dbContext;

    public AdminBootstrapRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<AdminBootstrapResult> EnsureAdministratorAsync(
        string username,
        string email,
        Func<User> createAdministrator,
        CancellationToken cancellationToken = default)
    {
        await using var transaction = await _dbContext.Database
            .BeginTransactionAsync(cancellationToken);

        await _dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT pg_advisory_xact_lock({AdvisoryLockKey})",
            cancellationToken);

        var existingResult = await ResolveExistingAccountAsync(
            username,
            email,
            cancellationToken);

        if (existingResult.HasValue)
        {
            await transaction.CommitAsync(cancellationToken);
            return existingResult.Value;
        }

        var administrator = createAdministrator();
        await _dbContext.Users.AddAsync(administrator, cancellationToken);

        try
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return AdminBootstrapResult.Created;
        }
        catch (DbUpdateException exception) when (
            exception.InnerException is PostgresException
            {
                SqlState: PostgresErrorCodes.UniqueViolation
            } postgresException
            && IsIdentityUniqueConstraint(postgresException.ConstraintName))
        {
            await transaction.RollbackAsync(cancellationToken);
            _dbContext.ChangeTracker.Clear();

            var raceResult = await ResolveExistingAccountAsync(
                username,
                email,
                cancellationToken);

            if (raceResult is AdminBootstrapResult.AlreadyExists)
            {
                return raceResult.Value;
            }

            throw CreateConflictException();
        }
    }

    private async Task<AdminBootstrapResult?> ResolveExistingAccountAsync(
        string username,
        string email,
        CancellationToken cancellationToken)
    {
        var usernamePattern = EscapeLikePattern(username);
        var emailPattern = EscapeLikePattern(email);
        var matchingUsers = await _dbContext.Users
            .AsNoTracking()
            .Where(user => EF.Functions.ILike(
                    user.Username,
                    usernamePattern,
                    LikeEscapeCharacter)
                || EF.Functions.ILike(
                    user.Email,
                    emailPattern,
                    LikeEscapeCharacter))
            .ToListAsync(cancellationToken);
        var usernameMatches = matchingUsers
            .Where(user => string.Equals(
                user.Username,
                username,
                StringComparison.OrdinalIgnoreCase))
            .ToArray();
        var emailMatches = matchingUsers
            .Where(user => string.Equals(
                user.Email,
                email,
                StringComparison.OrdinalIgnoreCase))
            .ToArray();

        if (usernameMatches.Length == 0 && emailMatches.Length == 0)
        {
            return null;
        }

        if (usernameMatches.Length == 1
            && emailMatches.Length == 1
            && usernameMatches[0].Id == emailMatches[0].Id
            && usernameMatches[0].Role is UserRole.Admin)
        {
            return AdminBootstrapResult.AlreadyExists;
        }

        throw CreateConflictException();
    }

    private static AdminBootstrapException CreateConflictException()
    {
        return new AdminBootstrapException(
            "Administrator bootstrap conflicts with existing user identity data.");
    }

    internal static bool IsIdentityUniqueConstraint(string? constraintName)
    {
        return constraintName is UsernameUniqueConstraintName
            or EmailUniqueConstraintName;
    }

    private static string EscapeLikePattern(string value)
    {
        return value
            .Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("%", "\\%", StringComparison.Ordinal)
            .Replace("_", "\\_", StringComparison.Ordinal);
    }
}
