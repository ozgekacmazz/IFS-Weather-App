using IFSWeather.Api.Settings;

namespace IFSWeather.Api.Extensions;

public static class CorsExtensions
{
    public const string FrontendPolicyName = "Frontend";

    public static IServiceCollection AddFrontendCors(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var settings = configuration
            .GetSection(FrontendCorsSettings.SectionName)
            .Get<FrontendCorsSettings>() ?? new FrontendCorsSettings();
        var allowedOrigins = NormalizeAndValidateOrigins(
            settings.AllowedOrigins ?? []);

        services.AddCors(options =>
        {
            options.AddPolicy(FrontendPolicyName, policy =>
            {
                policy
                    .WithOrigins(allowedOrigins)
                    .AllowAnyHeader()
                    .AllowAnyMethod();
            });
        });

        return services;
    }

    private static string[] NormalizeAndValidateOrigins(
        IEnumerable<string?> configuredOrigins)
    {
        var allowedOrigins = new HashSet<string>(
            StringComparer.OrdinalIgnoreCase);

        foreach (var configuredOrigin in configuredOrigins)
        {
            var origin = configuredOrigin?.Trim();

            if (string.IsNullOrEmpty(origin))
            {
                continue;
            }

            if (origin.Contains('*', StringComparison.Ordinal)
                || !Uri.TryCreate(origin, UriKind.Absolute, out var uri)
                || (!string.Equals(
                        uri.Scheme,
                        Uri.UriSchemeHttp,
                        StringComparison.OrdinalIgnoreCase)
                    && !string.Equals(
                        uri.Scheme,
                        Uri.UriSchemeHttps,
                        StringComparison.OrdinalIgnoreCase))
                || string.IsNullOrEmpty(uri.Host)
                || !string.IsNullOrEmpty(uri.UserInfo)
                || uri.AbsolutePath is not ("" or "/")
                || !string.IsNullOrEmpty(uri.Query)
                || !string.IsNullOrEmpty(uri.Fragment))
            {
                throw new InvalidOperationException(
                    "Cors:AllowedOrigins contains an invalid HTTP or HTTPS origin.");
            }

            allowedOrigins.Add(uri.GetLeftPart(UriPartial.Authority));
        }

        return allowedOrigins.ToArray();
    }
}
