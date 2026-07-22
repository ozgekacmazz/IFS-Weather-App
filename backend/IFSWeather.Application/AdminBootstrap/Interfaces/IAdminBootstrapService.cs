using IFSWeather.Application.AdminBootstrap.Models;

namespace IFSWeather.Application.AdminBootstrap.Interfaces;

public interface IAdminBootstrapService
{
    Task<AdminBootstrapResult> ExecuteAsync(
        AdminBootstrapSettings settings,
        CancellationToken cancellationToken = default);
}
