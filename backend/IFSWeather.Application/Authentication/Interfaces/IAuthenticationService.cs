using IFSWeather.Application.Authentication.DTOs;

namespace IFSWeather.Application.Authentication.Interfaces;

public interface IAuthenticationService
{
    Task<AuthenticationResponse> RegisterAsync(
        RegisterRequest request,
        CancellationToken cancellationToken = default);

    Task<AuthenticationResponse> LoginAsync(
        LoginRequest request,
        CancellationToken cancellationToken = default);
}
