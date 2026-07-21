using IFSWeather.Domain.Enums;

namespace IFSWeather.Application.Authentication.DTOs;

public sealed record AuthenticationResponse(
    int UserId,
    string Username,
    string Email,
    UserRole Role,
    string AccessToken,
    DateTime ExpiresAtUtc);
