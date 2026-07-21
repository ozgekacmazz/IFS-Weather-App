using IFSWeather.Domain.Entities;

namespace IFSWeather.Application.Authentication.Interfaces;

public interface IUserRepository
{
    Task<User?> GetByUsernameOrEmailAsync(
        string value,
        CancellationToken cancellationToken);

    Task<bool> UsernameExistsAsync(
        string username,
        CancellationToken cancellationToken);

    Task<bool> EmailExistsAsync(
        string email,
        CancellationToken cancellationToken);

    Task AddAsync(User user, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
