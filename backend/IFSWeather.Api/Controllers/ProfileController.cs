using IFSWeather.Application.Profile.DTOs;
using IFSWeather.Application.Profile.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IFSWeather.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public sealed class ProfileController : ControllerBase
{
    private readonly IProfileService _profileService;

    public ProfileController(IProfileService profileService)
    {
        _profileService = profileService;
    }

    [HttpGet]
    [ProducesResponseType<ProfileResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<ProfileResponse>> Get(
        CancellationToken cancellationToken)
    {
        var response = await _profileService.GetCurrentProfileAsync(
            cancellationToken);

        return Ok(response);
    }

    [HttpPut]
    [ProducesResponseType<ProfileResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<ProfileResponse>> Update(
        UpdateProfileRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _profileService.UpdateCurrentProfileAsync(
            request,
            cancellationToken);

        return Ok(response);
    }
}
