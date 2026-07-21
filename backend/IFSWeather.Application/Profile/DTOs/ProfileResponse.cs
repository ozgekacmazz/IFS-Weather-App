using IFSWeather.Domain.Enums;

namespace IFSWeather.Application.Profile.DTOs;

public sealed record ProfileResponse(
    int UserId,
    string FirstName,
    string LastName,
    string Username,
    string Email,
    string? DefaultCity,
    UserRole Role,
    UserStatus Status,
    DateTime CreatedAt);
