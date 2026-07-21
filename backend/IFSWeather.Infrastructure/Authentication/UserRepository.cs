using IFSWeather.Application.Authentication.Interfaces;
using IFSWeather.Domain.Entities;
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

    public Task<User?> GetByUsernameOrEmailAsync(
        string value,
        CancellationToken cancellationToken)
    {
        var pattern = EscapeLikePattern(value);

        return _dbContext.Users
            .AsNoTracking()
            .SingleOrDefaultAsync(
                user => EF.Functions.ILike(
                            user.Username,
                            pattern,
                            LikeEscapeCharacter)
                        || EF.Functions.ILike(
                            user.Email,
                            pattern,
                            LikeEscapeCharacter),
                cancellationToken);
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
