using IFSWeather.Domain.Entities;

namespace IFSWeather.Application.Authentication.Interfaces;

public interface IUserLoginLogRepository
{
    Task AddAsync(
        UserLoginLog loginLog,
        CancellationToken cancellationToken = default);

    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
