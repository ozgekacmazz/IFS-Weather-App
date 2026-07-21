using IFSWeather.Application.Authentication.Interfaces;
using IFSWeather.Application.Common.Interfaces;
using IFSWeather.Application.Profile.DTOs;
using IFSWeather.Application.Profile.Exceptions;
using IFSWeather.Application.Profile.Interfaces;

namespace IFSWeather.Application.Profile.Services;

public sealed class ProfileService : IProfileService
{
    private readonly ICurrentUserService _currentUserService;
    private readonly IUserRepository _userRepository;

    public ProfileService(
        ICurrentUserService currentUserService,
        IUserRepository userRepository)
    {
        _currentUserService = currentUserService;
        _userRepository = userRepository;
    }

    public async Task<ProfileResponse> GetCurrentProfileAsync(
        CancellationToken cancellationToken = default)
    {
        if (!_currentUserService.IsAuthenticated
            || _currentUserService.UserId is not int userId)
        {
            throw new ProfileUnavailableException();
        }

        var user = await _userRepository.GetByIdAsync(userId, cancellationToken);

        if (user is null)
        {
            throw new ProfileUnavailableException();
        }

        return new ProfileResponse(
            user.Id,
            user.FirstName,
            user.LastName,
            user.Username,
            user.Email,
            user.DefaultCity,
            user.Role,
            user.Status,
            user.CreatedAt);
    }
}
