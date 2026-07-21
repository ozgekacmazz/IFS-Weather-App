using IFSWeather.Application.Admin.Users.DTOs;
using IFSWeather.Application.Admin.Users.Models;
using IFSWeather.Application.Common.Models;

namespace IFSWeather.Application.Admin.Users.Interfaces;

public interface IAdminUserService
{
    Task<PaginatedResponse<AdminUserSummaryResponse>> GetUsersAsync(
        AdminUserQuery query,
        CancellationToken cancellationToken = default);

    Task<AdminUserDetailResponse> GetUserByIdAsync(
        int userId,
        CancellationToken cancellationToken = default);

    Task<AdminUserDetailResponse> UpdateUserStatusAsync(
        int userId,
        UpdateUserStatusRequest request,
        CancellationToken cancellationToken = default);
}
