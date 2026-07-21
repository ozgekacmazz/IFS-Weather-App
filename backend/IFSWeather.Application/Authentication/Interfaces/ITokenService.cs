using IFSWeather.Application.Authentication.Models;
using IFSWeather.Domain.Entities;

namespace IFSWeather.Application.Authentication.Interfaces;

public interface ITokenService
{
    Task<TokenResult> GenerateTokenAsync(
        User user,
        CancellationToken cancellationToken = default);
}
