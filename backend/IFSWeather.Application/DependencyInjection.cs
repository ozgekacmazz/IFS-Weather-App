using FluentValidation;
using IFSWeather.Application.Authentication.Interfaces;
using IFSWeather.Application.Authentication.Services;
using IFSWeather.Application.Authentication.Validators;
using Microsoft.Extensions.DependencyInjection;

namespace IFSWeather.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddValidatorsFromAssemblyContaining<RegisterRequestValidator>();
        services.AddScoped<IAuthenticationService, AuthenticationService>();

        return services;
    }
}
