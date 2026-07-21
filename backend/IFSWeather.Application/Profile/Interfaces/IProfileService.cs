using IFSWeather.Application.Profile.DTOs;

namespace IFSWeather.Application.Profile.Interfaces;

public interface IProfileService
{
    Task<ProfileResponse> GetCurrentProfileAsync(
        CancellationToken cancellationToken = default);
}
