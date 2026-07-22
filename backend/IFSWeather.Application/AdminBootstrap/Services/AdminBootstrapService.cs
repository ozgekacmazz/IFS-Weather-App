using FluentValidation;
using IFSWeather.Application.AdminBootstrap.Exceptions;
using IFSWeather.Application.AdminBootstrap.Interfaces;
using IFSWeather.Application.AdminBootstrap.Models;
using IFSWeather.Application.Authentication.DTOs;
using IFSWeather.Application.Authentication.Interfaces;
using IFSWeather.Domain.Entities;
using IFSWeather.Domain.Enums;

namespace IFSWeather.Application.AdminBootstrap.Services;

public sealed class AdminBootstrapService : IAdminBootstrapService
{
    private readonly IAdminBootstrapRepository _repository;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IValidator<RegisterRequest> _registerRequestValidator;
    private readonly TimeProvider _timeProvider;

    public AdminBootstrapService(
        IAdminBootstrapRepository repository,
        IPasswordHasher passwordHasher,
        IValidator<RegisterRequest> registerRequestValidator,
        TimeProvider timeProvider)
    {
        _repository = repository;
        _passwordHasher = passwordHasher;
        _registerRequestValidator = registerRequestValidator;
        _timeProvider = timeProvider;
    }

    public async Task<AdminBootstrapResult> ExecuteAsync(
        AdminBootstrapSettings settings,
        CancellationToken cancellationToken = default)
    {
        if (!settings.Enabled)
        {
            return AdminBootstrapResult.Disabled;
        }

        var configuredUsername = settings.Username;
        var configuredEmail = settings.Email;
        var configuredPassword = settings.Password;

        if (string.IsNullOrWhiteSpace(configuredUsername)
            || string.IsNullOrWhiteSpace(configuredEmail)
            || string.IsNullOrWhiteSpace(configuredPassword))
        {
            throw new AdminBootstrapException(
                "Enabled administrator bootstrap configuration is incomplete.");
        }

        var username = configuredUsername.Trim();
        var email = configuredEmail.Trim().ToLowerInvariant();
        var registrationRequest = new RegisterRequest(
            username,
            username,
            username,
            email,
            configuredPassword,
            null);

        var validationResult = await _registerRequestValidator.ValidateAsync(
            registrationRequest,
            cancellationToken);

        if (!validationResult.IsValid)
        {
            throw new AdminBootstrapException(
                "Enabled administrator bootstrap configuration does not satisfy user validation requirements.");
        }

        return await _repository.EnsureAdministratorAsync(
            username,
            email,
            () => CreateAdministrator(username, email, configuredPassword),
            cancellationToken);
    }

    private User CreateAdministrator(
        string username,
        string email,
        string password)
    {
        var utcNow = _timeProvider.GetUtcNow().UtcDateTime;
        var administrator = new User
        {
            FirstName = username,
            LastName = username,
            Username = username,
            Email = email,
            PasswordHash = string.Empty,
            DefaultCity = null,
            Role = UserRole.Admin,
            Status = UserStatus.Active,
            CreatedAt = utcNow,
            UpdatedAt = utcNow
        };

        administrator.PasswordHash = _passwordHasher.HashPassword(
            administrator,
            password);

        return administrator;
    }
}
