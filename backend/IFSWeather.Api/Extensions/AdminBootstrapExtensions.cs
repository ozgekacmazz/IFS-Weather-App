using IFSWeather.Application.AdminBootstrap.Exceptions;
using IFSWeather.Application.AdminBootstrap.Interfaces;
using IFSWeather.Application.AdminBootstrap.Models;

namespace IFSWeather.Api.Extensions;

public static class AdminBootstrapExtensions
{
    public static async Task RunAdminBootstrapAsync(
        this WebApplication application,
        CancellationToken cancellationToken = default)
    {
        var logger = application.Services
            .GetRequiredService<ILoggerFactory>()
            .CreateLogger("AdminBootstrap");
        var settings = application.Configuration
            .GetSection(AdminBootstrapSettings.SectionName)
            .Get<AdminBootstrapSettings>() ?? new AdminBootstrapSettings();

        if (!settings.Enabled)
        {
            logger.LogInformation("Administrator bootstrap is disabled.");
            return;
        }

        await using var scope = application.Services.CreateAsyncScope();
        var bootstrapService = scope.ServiceProvider
            .GetRequiredService<IAdminBootstrapService>();

        try
        {
            var result = await bootstrapService.ExecuteAsync(
                settings,
                cancellationToken);

            if (result is AdminBootstrapResult.Created)
            {
                logger.LogInformation("Bootstrap administrator was created.");
            }
            else
            {
                logger.LogInformation(
                    "Bootstrap administrator already exists; no change was required.");
            }
        }
        catch (AdminBootstrapException)
        {
            logger.LogCritical(
                "Administrator bootstrap failed because configuration or existing user state is invalid.");
            throw;
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            logger.LogCritical(
                "Administrator bootstrap failed with exception type {ExceptionType}.",
                exception.GetType().Name);
            throw new AdminBootstrapException(
                "Administrator bootstrap could not be completed safely.");
        }
    }
}
