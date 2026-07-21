using FluentValidation;
using IFSWeather.Application.Authentication.Interfaces;
using IFSWeather.Application.Common.Interfaces;
using IFSWeather.Application.Profile.DTOs;
using IFSWeather.Application.Profile.Exceptions;
using IFSWeather.Application.Profile.Interfaces;
using IFSWeather.Domain.Entities;

namespace IFSWeather.Application.Profile.Services;

public sealed class ProfileService : IProfileService
{
    private readonly ICurrentUserService _currentUserService;
    private readonly IUserRepository _userRepository;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IValidator<UpdateProfileRequest> _updateRequestValidator;
    private readonly TimeProvider _timeProvider;

    public ProfileService(
        ICurrentUserService currentUserService,
        IUserRepository userRepository,
        IPasswordHasher passwordHasher,
        IValidator<UpdateProfileRequest> updateRequestValidator,
        TimeProvider timeProvider)
    {
        _currentUserService = currentUserService;
        _userRepository = userRepository;
        _passwordHasher = passwordHasher;
        _updateRequestValidator = updateRequestValidator;
        _timeProvider = timeProvider;
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

        return CreateResponse(user);
    }

    public async Task<ProfileResponse> UpdateCurrentProfileAsync(
        UpdateProfileRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!_currentUserService.IsAuthenticated
            || _currentUserService.UserId is not int userId)
        {
            throw new ProfileUnavailableException();
        }

        var normalizedRequest = request with
        {
            FirstName = NormalizeRequiredValue(request.FirstName),
            LastName = NormalizeRequiredValue(request.LastName),
            DefaultCity = NormalizeOptionalValue(request.DefaultCity)
        };

        await _updateRequestValidator.ValidateAndThrowAsync(
            normalizedRequest,
            cancellationToken);

        var user = await _userRepository.GetTrackedByIdAsync(
            userId,
            cancellationToken);

        if (user is null)
        {
            throw new ProfileUnavailableException();
        }

        if (!string.IsNullOrEmpty(normalizedRequest.NewPassword))
        {
            if (!_passwordHasher.VerifyPassword(
                    user,
                    user.PasswordHash,
                    normalizedRequest.CurrentPassword!))
            {
                throw new InvalidCurrentPasswordException();
            }

            user.PasswordHash = _passwordHasher.HashPassword(
                user,
                normalizedRequest.NewPassword);
        }

        user.FirstName = normalizedRequest.FirstName;
        user.LastName = normalizedRequest.LastName;
        user.DefaultCity = normalizedRequest.DefaultCity;
        user.UpdatedAt = _timeProvider.GetUtcNow().UtcDateTime;

        await _userRepository.SaveChangesAsync(cancellationToken);

        return CreateResponse(user);
    }

    private static ProfileResponse CreateResponse(User user)
    {
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

    private static string? NormalizeOptionalValue(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static string NormalizeRequiredValue(string? value)
    {
        return value?.Trim() ?? string.Empty;
    }
}
