using IFSWeather.Domain.Enums;

namespace IFSWeather.Application.Admin.Users.Models;

public sealed record AdminUserQuery
{
    public int PageNumber { get; init; } = 1;

    public int PageSize { get; init; } = 20;

    public string? Search { get; init; }

    public UserStatus? Status { get; init; }
}
