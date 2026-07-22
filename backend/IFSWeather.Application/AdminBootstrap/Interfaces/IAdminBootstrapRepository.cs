using IFSWeather.Application.AdminBootstrap.Models;
using IFSWeather.Domain.Entities;

namespace IFSWeather.Application.AdminBootstrap.Interfaces;

public interface IAdminBootstrapRepository
{
    Task<AdminBootstrapResult> EnsureAdministratorAsync(
        string username,
        string email,
        Func<User> createAdministrator,
        CancellationToken cancellationToken = default);
}
