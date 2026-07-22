namespace IFSWeather.Api.Settings;

public sealed class FrontendCorsSettings
{
    public const string SectionName = "Cors";

    public string?[] AllowedOrigins { get; set; } = [];
}
