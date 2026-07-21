using IFSWeather.Domain.Enums;

namespace IFSWeather.Application.Admin.Users.DTOs;

public sealed record AdminUserDetailResponse(
    int UserId,
    string FirstName,
    string LastName,
    string Username,
    string Email,
    string? DefaultCity,
    UserRole Role,
    UserStatus Status,
    DateTime CreatedAt,
    DateTime UpdatedAt);
