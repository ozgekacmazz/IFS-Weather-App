using FluentValidation;
using IFSWeather.Application.Authentication.Interfaces;
using IFSWeather.Application.Authentication.Services;
using IFSWeather.Application.Authentication.Validators;
using IFSWeather.Application.Profile.Interfaces;
using IFSWeather.Application.Profile.Services;
using Microsoft.Extensions.DependencyInjection;

namespace IFSWeather.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddValidatorsFromAssemblyContaining<RegisterRequestValidator>();
        services.AddScoped<IAuthenticationService, AuthenticationService>();
        services.AddScoped<IProfileService, ProfileService>();

        return services;
    }
}
