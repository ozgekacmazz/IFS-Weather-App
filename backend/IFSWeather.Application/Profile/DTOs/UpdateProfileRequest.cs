namespace IFSWeather.Application.Profile.DTOs;

public sealed record UpdateProfileRequest(
    string FirstName,
    string LastName,
    string? DefaultCity,
    string? CurrentPassword,
    string? NewPassword);
