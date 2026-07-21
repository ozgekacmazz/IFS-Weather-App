using IFSWeather.Application.Authentication.Interfaces;
using IFSWeather.Application.Authentication.Settings;
using IFSWeather.Infrastructure.Authentication;
using IFSWeather.Infrastructure.Persistence;
using IFSWeather.Infrastructure.Weather;
using IFSWeather.Application.Weather.Interfaces;
using IFSWeather.Application.Weather.External.Interfaces;
using IFSWeather.Infrastructure.Weather.External;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IFSWeather.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException(
                "Connection string 'DefaultConnection' was not found.");

        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(connectionString));

        services.AddScoped<IPasswordHasher, PasswordHasher>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IUserLoginLogRepository, UserLoginLogRepository>();
        services.AddScoped<ILoginAuditService, LoginAuditService>();
        services.AddScoped<ITokenService, JwtTokenService>();
        services.AddSingleton(TimeProvider.System);
        services.AddScoped<IWeatherRepository, WeatherRepository>();

        services.AddOptions<JwtSettings>()
            .Bind(configuration.GetSection(JwtSettings.SectionName))
            .Validate(
                settings => !string.IsNullOrWhiteSpace(settings.Issuer),
                "JWT issuer must be configured.")
            .Validate(
                settings => !string.IsNullOrWhiteSpace(settings.Audience),
                "JWT audience must be configured.")
            .Validate(
                settings => settings.AccessTokenExpirationMinutes > 0,
                "JWT access token expiration must be greater than zero.")
            .Validate(
                settings => !string.IsNullOrWhiteSpace(settings.SecretKey),
                "JWT secret key must be configured.")
            .Validate(
                settings => settings.SecretKey.Length >= 32,
                "JWT secret key must contain at least 32 characters.")
            .ValidateOnStart();

        services.AddOptions<WeatherApiOptions>()
            .Bind(configuration.GetSection(WeatherApiOptions.SectionName))
            .Validate(
                options => Uri.TryCreate(
                    options.BaseUrl,
                    UriKind.Absolute,
                    out var baseUri)
                    && baseUri.Scheme == Uri.UriSchemeHttps,
                "Weather API base URL must be an absolute HTTPS URI.")
            .Validate(
                options => !string.IsNullOrWhiteSpace(options.ApiKey),
                "Weather API key must be configured.")
            .Validate(
                options => options.TimeoutSeconds is >= 1 and <= 30,
                "Weather API timeout must be between 1 and 30 seconds.")
            .Validate(
                options => options.MaximumForecastDays is >= 1 and <= 14,
                "Weather API maximum forecast days must be between 1 and 14.")
            .ValidateOnStart();

        services.AddHttpClient<IExternalWeatherProvider, WeatherApiProvider>(
                (serviceProvider, httpClient) =>
                {
                    var options = serviceProvider
                        .GetRequiredService<Microsoft.Extensions.Options.IOptions<WeatherApiOptions>>()
                        .Value;

                    httpClient.BaseAddress = new Uri(options.BaseUrl, UriKind.Absolute);
                    httpClient.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);
                })
            .RemoveAllLoggers();

        return services;
    }
}
