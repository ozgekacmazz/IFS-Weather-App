namespace IFSWeather.Application.Authentication.DTOs;

public sealed record LoginRequest(
    string UsernameOrEmail,
    string Password);
