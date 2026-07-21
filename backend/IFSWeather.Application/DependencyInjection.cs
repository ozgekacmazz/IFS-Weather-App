using FluentValidation;
using IFSWeather.Application.Admin.Users.Interfaces;
using IFSWeather.Application.Admin.Users.Services;
using IFSWeather.Application.Authentication.Interfaces;
using IFSWeather.Application.Authentication.Services;
using IFSWeather.Application.Authentication.Validators;
using IFSWeather.Application.Profile.Interfaces;
using IFSWeather.Application.Profile.Services;
using IFSWeather.Application.Weather.Interfaces;
using IFSWeather.Application.Weather.Services;
using Microsoft.Extensions.DependencyInjection;

namespace IFSWeather.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddValidatorsFromAssemblyContaining<RegisterRequestValidator>();
        services.AddScoped<IAuthenticationService, AuthenticationService>();
        services.AddScoped<IProfileService, ProfileService>();
        services.AddScoped<IAdminUserService, AdminUserService>();
        services.AddScoped<IWeatherManagementService, WeatherManagementService>();
        services.AddScoped<IUserWeatherService, UserWeatherService>();

        return services;
    }
}
