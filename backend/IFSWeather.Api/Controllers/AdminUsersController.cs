using IFSWeather.Application.Admin.Users.DTOs;
using IFSWeather.Application.Admin.Users.Interfaces;
using IFSWeather.Application.Admin.Users.Models;
using IFSWeather.Application.Common.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IFSWeather.Api.Controllers;

[ApiController]
[Route("api/admin/users")]
[Authorize(Roles = "Admin")]
public sealed class AdminUsersController : ControllerBase
{
    private readonly IAdminUserService _adminUserService;

    public AdminUsersController(IAdminUserService adminUserService)
    {
        _adminUserService = adminUserService;
    }

    [HttpGet]
    [ProducesResponseType<PaginatedResponse<AdminUserSummaryResponse>>(
        StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<PaginatedResponse<AdminUserSummaryResponse>>> GetUsers(
        [FromQuery] AdminUserQuery query,
        CancellationToken cancellationToken)
    {
        var response = await _adminUserService.GetUsersAsync(
            query,
            cancellationToken);

        return Ok(response);
    }

    [HttpGet("{userId:int}")]
    [ProducesResponseType<AdminUserDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminUserDetailResponse>> GetUserById(
        int userId,
        CancellationToken cancellationToken)
    {
        var response = await _adminUserService.GetUserByIdAsync(
            userId,
            cancellationToken);

        return Ok(response);
    }

    [HttpPatch("{userId:int}/status")]
    [ProducesResponseType<AdminUserDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AdminUserDetailResponse>> UpdateUserStatus(
        int userId,
        UpdateUserStatusRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _adminUserService.UpdateUserStatusAsync(
            userId,
            request,
            cancellationToken);

        return Ok(response);
    }
}
