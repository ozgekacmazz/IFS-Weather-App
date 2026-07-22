namespace IFSWeather.Application.AdminBootstrap.Models;

public sealed class AdminBootstrapSettings
{
    public const string SectionName = "AdminBootstrap";

    public bool Enabled { get; set; }

    public string? Username { get; set; }

    public string? Email { get; set; }

    public string? Password { get; set; }
}
