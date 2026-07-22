using IFSWeather.Domain.Entities;
using IFSWeather.Domain.Enums;

namespace IFSWeather.Application.Authentication.Interfaces;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(
        int userId,
        CancellationToken cancellationToken = default);

    Task<(IReadOnlyList<User> Users, int TotalCount)> GetPagedAsync(
        int pageNumber,
        int pageSize,
        string? search,
        UserStatus? status,
        CancellationToken cancellationToken = default);

    Task<User?> GetTrackedByIdAsync(
        int userId,
        CancellationToken cancellationToken = default);

    Task<TResult?> ExecuteWithUserLockAsync<TResult>(
        string value,
        Func<User, TResult> operation,
        CancellationToken cancellationToken)
        where TResult : class;

    Task<bool> UsernameExistsAsync(
        string username,
        CancellationToken cancellationToken);

    Task<bool> EmailExistsAsync(
        string email,
        CancellationToken cancellationToken);

    Task AddAsync(User user, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
