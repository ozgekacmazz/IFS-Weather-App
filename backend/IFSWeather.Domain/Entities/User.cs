using IFSWeather.Domain.Common;
using IFSWeather.Domain.Enums;

namespace IFSWeather.Domain.Entities;

public class User : BaseEntity
{
    public required string FirstName { get; set; }

    public required string LastName { get; set; }

    public required string Username { get; set; }

    public required string Email { get; set; }

    public required string PasswordHash { get; set; }

    public string? DefaultCity { get; set; }

    public UserRole Role { get; set; } = UserRole.User;

    public UserStatus Status { get; set; } = UserStatus.Active;
}