using IFSWeather.Domain.Enums;

namespace IFSWeather.Application.Admin.Users.DTOs;

public sealed record UpdateUserStatusRequest(UserStatus Status);
