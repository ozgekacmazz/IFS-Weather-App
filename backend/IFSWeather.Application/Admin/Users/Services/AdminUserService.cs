using FluentValidation;
using IFSWeather.Application.Admin.Users.DTOs;
using IFSWeather.Application.Admin.Users.Exceptions;
using IFSWeather.Application.Admin.Users.Interfaces;
using IFSWeather.Application.Admin.Users.Models;
using IFSWeather.Application.Authentication.Interfaces;
using IFSWeather.Application.Common.Interfaces;
using IFSWeather.Application.Common.Models;
using IFSWeather.Domain.Entities;
using IFSWeather.Domain.Enums;

namespace IFSWeather.Application.Admin.Users.Services;

public sealed class AdminUserService : IAdminUserService
{
    private readonly IUserRepository _userRepository;
    private readonly ICurrentUserService _currentUserService;
    private readonly IValidator<AdminUserQuery> _queryValidator;
    private readonly IValidator<UpdateUserStatusRequest> _statusValidator;

    public AdminUserService(
        IUserRepository userRepository,
        ICurrentUserService currentUserService,
        IValidator<AdminUserQuery> queryValidator,
        IValidator<UpdateUserStatusRequest> statusValidator)
    {
        _userRepository = userRepository;
        _currentUserService = currentUserService;
        _queryValidator = queryValidator;
        _statusValidator = statusValidator;
    }

    public async Task<PaginatedResponse<AdminUserSummaryResponse>> GetUsersAsync(
        AdminUserQuery query,
        CancellationToken cancellationToken = default)
    {
        var normalizedQuery = query with
        {
            Search = NormalizeSearch(query.Search)
        };

        await _queryValidator.ValidateAndThrowAsync(
            normalizedQuery,
            cancellationToken);

        var (users, totalCount) = await _userRepository.GetPagedAsync(
            normalizedQuery.PageNumber,
            normalizedQuery.PageSize,
            normalizedQuery.Search,
            normalizedQuery.Status,
            cancellationToken);
        var items = users.Select(MapSummary).ToArray();
        var totalPages = (int)Math.Ceiling(
            totalCount / (double)normalizedQuery.PageSize);

        return new PaginatedResponse<AdminUserSummaryResponse>(
            items,
            normalizedQuery.PageNumber,
            normalizedQuery.PageSize,
            totalCount,
            totalPages);
    }

    public async Task<AdminUserDetailResponse> GetUserByIdAsync(
        int userId,
        CancellationToken cancellationToken = default)
    {
        var user = await _userRepository.GetByIdAsync(userId, cancellationToken)
            ?? throw new AdminUserNotFoundException();

        return MapDetail(user);
    }

    public async Task<AdminUserDetailResponse> UpdateUserStatusAsync(
        int userId,
        UpdateUserStatusRequest request,
        CancellationToken cancellationToken = default)
    {
        await _statusValidator.ValidateAndThrowAsync(request, cancellationToken);

        var user = await _userRepository.GetTrackedByIdAsync(
                userId,
                cancellationToken)
            ?? throw new AdminUserNotFoundException();

        if (_currentUserService.UserId == userId
            && request.Status is not UserStatus.Active)
        {
            throw new AdminSelfDeactivationException();
        }

        user.Status = request.Status;
        user.UpdatedAt = DateTime.UtcNow;

        await _userRepository.SaveChangesAsync(cancellationToken);

        return MapDetail(user);
    }

    private static AdminUserSummaryResponse MapSummary(User user)
    {
        return new AdminUserSummaryResponse(
            user.Id,
            user.FirstName,
            user.LastName,
            user.Username,
            user.Email,
            user.DefaultCity,
            user.Role,
            user.Status,
            user.CreatedAt);
    }

    private static AdminUserDetailResponse MapDetail(User user)
    {
        return new AdminUserDetailResponse(
            user.Id,
            user.FirstName,
            user.LastName,
            user.Username,
            user.Email,
            user.DefaultCity,
            user.Role,
            user.Status,
            user.CreatedAt,
            user.UpdatedAt);
    }

    private static string? NormalizeSearch(string? search)
    {
        return string.IsNullOrWhiteSpace(search) ? null : search.Trim();
    }
}
