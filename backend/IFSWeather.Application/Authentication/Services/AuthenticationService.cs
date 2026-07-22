using FluentValidation;
using IFSWeather.Application.Authentication.DTOs;
using IFSWeather.Application.Authentication.Exceptions;
using IFSWeather.Application.Authentication.Interfaces;
using IFSWeather.Application.Authentication.Models;
using IFSWeather.Domain.Entities;
using IFSWeather.Domain.Enums;

namespace IFSWeather.Application.Authentication.Services;

public sealed class AuthenticationService : IAuthenticationService
{
    private const int MaximumFailedLoginAttempts = 3;
    private static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(1);

    private readonly IUserRepository _userRepository;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ITokenService _tokenService;
    private readonly ILoginAuditService _loginAuditService;
    private readonly TimeProvider _timeProvider;
    private readonly IValidator<RegisterRequest> _registerRequestValidator;
    private readonly IValidator<LoginRequest> _loginRequestValidator;

    public AuthenticationService(
        IUserRepository userRepository,
        IPasswordHasher passwordHasher,
        ITokenService tokenService,
        ILoginAuditService loginAuditService,
        TimeProvider timeProvider,
        IValidator<RegisterRequest> registerRequestValidator,
        IValidator<LoginRequest> loginRequestValidator)
    {
        _userRepository = userRepository;
        _passwordHasher = passwordHasher;
        _tokenService = tokenService;
        _loginAuditService = loginAuditService;
        _timeProvider = timeProvider;
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

        var token = await _tokenService.GenerateTokenAsync(user, cancellationToken);

        return CreateResponse(user, token);
    }

    public async Task<AuthenticationResponse> LoginAsync(
        LoginRequest request,
        string? ipAddress,
        CancellationToken cancellationToken = default)
    {
        var normalizedRequest = request with
        {
            UsernameOrEmail = NormalizeRequiredValue(request.UsernameOrEmail)
        };

        await _loginRequestValidator.ValidateAndThrowAsync(
            normalizedRequest,
            cancellationToken);

        var user = await _userRepository.GetTrackedByUsernameOrEmailAsync(
            normalizedRequest.UsernameOrEmail,
            cancellationToken);

        if (user is null)
        {
            await _loginAuditService.RecordAsync(
                normalizedRequest.UsernameOrEmail,
                ipAddress,
                LoginAuditOutcome.Failed,
                cancellationToken);

            throw new InvalidCredentialsException();
        }

        if (user.Status is not UserStatus.Active)
        {
            await _loginAuditService.RecordAsync(
                user.Username,
                ipAddress,
                LoginAuditOutcome.Failed,
                cancellationToken);

            throw new InactiveUserException();
        }

        var utcNow = _timeProvider.GetUtcNow().UtcDateTime;

        if (user.LockoutEndUtc > utcNow)
        {
            await _loginAuditService.RecordAsync(
                user.Username,
                ipAddress,
                LoginAuditOutcome.Locked,
                cancellationToken);

            throw new InvalidCredentialsException();
        }

        if (user.LockoutEndUtc.HasValue)
        {
            user.FailedLoginAttempts = 0;
            user.LockoutEndUtc = null;
            user.UpdatedAt = utcNow;

            await _userRepository.SaveChangesAsync(cancellationToken);
        }

        if (!_passwordHasher.VerifyPassword(
                user,
                user.PasswordHash,
                normalizedRequest.Password))
        {
            user.FailedLoginAttempts++;
            user.UpdatedAt = utcNow;

            var auditOutcome = LoginAuditOutcome.Failed;

            if (user.FailedLoginAttempts >= MaximumFailedLoginAttempts)
            {
                user.LockoutEndUtc = utcNow.Add(LockoutDuration);
                auditOutcome = LoginAuditOutcome.Locked;
            }

            await _userRepository.SaveChangesAsync(cancellationToken);

            await _loginAuditService.RecordAsync(
                user.Username,
                ipAddress,
                auditOutcome,
                cancellationToken);

            throw new InvalidCredentialsException();
        }

        user.FailedLoginAttempts = 0;
        user.LockoutEndUtc = null;
        user.UpdatedAt = utcNow;

        await _userRepository.SaveChangesAsync(cancellationToken);

        var token = await _tokenService.GenerateTokenAsync(user, cancellationToken);

        await _loginAuditService.RecordAsync(
            user.Username,
            ipAddress,
            LoginAuditOutcome.Succeeded,
            cancellationToken);

        return CreateResponse(user, token);
    }

    private static AuthenticationResponse CreateResponse(User user, TokenResult token)
    {
        return new AuthenticationResponse(
            user.Id,
            user.Username,
            user.Email,
            user.Role,
            token.AccessToken,
            token.ExpiresAtUtc);
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
