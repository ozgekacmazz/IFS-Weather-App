using IFSWeather.Application.Authentication.Interfaces;
using IFSWeather.Application.Authentication.Settings;
using IFSWeather.Infrastructure.Authentication;
using IFSWeather.Infrastructure.Persistence;
using IFSWeather.Infrastructure.Weather;
using IFSWeather.Application.Weather.Interfaces;
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
        services.AddScoped<ITokenService, JwtTokenService>();
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

        return services;
    }
}
