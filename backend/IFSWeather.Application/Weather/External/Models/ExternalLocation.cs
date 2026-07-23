namespace IFSWeather.Application.Weather.External.Models;

public sealed record ExternalLocation(
    long? ProviderLocationId,
    string Name,
    string? Region,
    string Country,
    decimal Latitude,
    decimal Longitude,
    string DisplayLabel);
