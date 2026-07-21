using IFSWeather.Application.Authentication.Models;

namespace IFSWeather.Application.Authentication.Interfaces;

public interface ILoginAuditService
{
    Task RecordAsync(
        string username,
        string? ipAddress,
        LoginAuditOutcome outcome,
        CancellationToken cancellationToken = default);
}
