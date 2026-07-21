namespace IFSWeather.Application.Authentication.DTOs;

public sealed record RegisterRequest(
    string FirstName,
    string LastName,
    string Username,
    string Email,
    string Password,
    string? DefaultCity);
