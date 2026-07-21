using IFSWeather.Application.Authentication.DTOs;
using IFSWeather.Application.Authentication.Interfaces;
using Microsoft.AspNetCore.Mvc;
using System.Net;

namespace IFSWeather.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class AuthController : ControllerBase
{
    private readonly IAuthenticationService _authenticationService;

    public AuthController(IAuthenticationService authenticationService)
    {
        _authenticationService = authenticationService;
    }

    [HttpPost("register")]
    [ProducesResponseType<AuthenticationResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<AuthenticationResponse>> Register(
        RegisterRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _authenticationService.RegisterAsync(
            request,
            cancellationToken);

        return Ok(response);
    }

    [HttpPost("login")]
    [ProducesResponseType<AuthenticationResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<AuthenticationResponse>> Login(
        LoginRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _authenticationService.LoginAsync(
            request,
            GetClientIpAddress(HttpContext.Connection.RemoteIpAddress),
            cancellationToken);

        return Ok(response);
    }

    private static string? GetClientIpAddress(IPAddress? remoteIpAddress)
    {
        if (remoteIpAddress is null)
        {
            return null;
        }

        return remoteIpAddress.IsIPv4MappedToIPv6
            ? remoteIpAddress.MapToIPv4().ToString()
            : remoteIpAddress.ToString();
    }
}
