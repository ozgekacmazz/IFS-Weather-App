using FluentValidation;
using IFSWeather.Application.Authentication.DTOs;
using IFSWeather.Application.Authentication.Exceptions;
using IFSWeather.Application.Authentication.Interfaces;
using IFSWeather.Domain.Entities;
using IFSWeather.Domain.Enums;

namespace IFSWeather.Application.Authentication.Services;

public sealed class AuthenticationService : IAuthenticationService
{
    private readonly IUserRepository _userRepository;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IValidator<RegisterRequest> _registerRequestValidator;
    private readonly IValidator<LoginRequest> _loginRequestValidator;

    public AuthenticationService(
        IUserRepository userRepository,
        IPasswordHasher passwordHasher,
        IValidator<RegisterRequest> registerRequestValidator,
        IValidator<LoginRequest> loginRequestValidator)
    {
        _userRepository = userRepository;
        _passwordHasher = passwordHasher;
        _registerRequestValidator = registerRequestValidator;
        _loginRequestValidator = loginRequestValidator;
    }

    public async Task<AuthenticationResponse> RegisterAsync(
        RegisterRequest request,
        CancellationToken cancellationToken = default)
    {
        var normalizedRequest = request with
        {
            FirstName = NormalizeRequiredValue(request.FirstName),
            LastName = NormalizeRequiredValue(request.LastName),
            Username = NormalizeRequiredValue(request.Username),
            Email = NormalizeRequiredValue(request.Email).ToLowerInvariant(),
            DefaultCity = NormalizeOptionalValue(request.DefaultCity)
        };

        await _registerRequestValidator.ValidateAndThrowAsync(
            normalizedRequest,
            cancellationToken);

        if (await _userRepository.UsernameExistsAsync(
                normalizedRequest.Username,
                cancellationToken)
            || await _userRepository.EmailExistsAsync(
                normalizedRequest.Email,
                cancellationToken))
        {
            throw new RegistrationConflictException();
        }

        var utcNow = DateTime.UtcNow;
        var user = new User
        {
            FirstName = normalizedRequest.FirstName,
            LastName = normalizedRequest.LastName,
            Username = normalizedRequest.Username,
            Email = normalizedRequest.Email,
            PasswordHash = string.Empty,
            DefaultCity = normalizedRequest.DefaultCity,
            Role = UserRole.User,
            Status = UserStatus.Active,
            CreatedAt = utcNow,
            UpdatedAt = utcNow
        };

        user.PasswordHash = _passwordHasher.HashPassword(
            user,
            normalizedRequest.Password);

        await _userRepository.AddAsync(user, cancellationToken);
        await _userRepository.SaveChangesAsync(cancellationToken);

        return CreateResponse(user);
    }

    public async Task<AuthenticationResponse> LoginAsync(
        LoginRequest request,
        CancellationToken cancellationToken = default)
    {
        var normalizedRequest = request with
        {
            UsernameOrEmail = NormalizeRequiredValue(request.UsernameOrEmail)
        };

        await _loginRequestValidator.ValidateAndThrowAsync(
            normalizedRequest,
            cancellationToken);

        var user = await _userRepository.GetByUsernameOrEmailAsync(
            normalizedRequest.UsernameOrEmail,
            cancellationToken);

        if (user is null)
        {
            throw new InvalidCredentialsException();
        }

        if (user.Status is not UserStatus.Active)
        {
            throw new InactiveUserException();
        }

        if (!_passwordHasher.VerifyPassword(
                user,
                user.PasswordHash,
                normalizedRequest.Password))
        {
            throw new InvalidCredentialsException();
        }

        return CreateResponse(user);
    }

    private static AuthenticationResponse CreateResponse(User user)
    {
        return new AuthenticationResponse(
            user.Id,
            user.Username,
            user.Email,
            user.Role,
            null,
            null);
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
