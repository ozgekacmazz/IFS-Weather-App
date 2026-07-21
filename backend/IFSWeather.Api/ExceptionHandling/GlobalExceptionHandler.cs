using FluentValidation;
using IFSWeather.Application.Admin.Users.Exceptions;
using IFSWeather.Application.Authentication.Exceptions;
using IFSWeather.Application.Profile.Exceptions;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace IFSWeather.Api.ExceptionHandling;

public sealed class GlobalExceptionHandler : IExceptionHandler
{
    private const string AuthenticationErrorMessage =
        "Authentication failed. Check your credentials and account status.";

    private readonly IProblemDetailsService _problemDetailsService;
    private readonly ILogger<GlobalExceptionHandler> _logger;

    public GlobalExceptionHandler(
        IProblemDetailsService problemDetailsService,
        ILogger<GlobalExceptionHandler> logger)
    {
        _problemDetailsService = problemDetailsService;
        _logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var problemDetails = CreateProblemDetails(exception);

        if (problemDetails.Status is StatusCodes.Status500InternalServerError)
        {
            _logger.LogError(exception, "An unhandled exception occurred.");
        }

        httpContext.Response.StatusCode = problemDetails.Status
            ?? StatusCodes.Status500InternalServerError;

        return await _problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = problemDetails,
            Exception = exception
        });
    }

    private static ProblemDetails CreateProblemDetails(Exception exception)
    {
        return exception switch
        {
            ValidationException validationException => CreateValidationProblem(
                validationException),

            RegistrationConflictException => CreateProblem(
                StatusCodes.Status409Conflict,
                "Registration conflict",
                "A user with the same username or email already exists."),

            AdminUserNotFoundException => CreateProblem(
                StatusCodes.Status404NotFound,
                "User not found",
                "The requested user could not be found."),

            AdminSelfDeactivationException => CreateProblem(
                StatusCodes.Status409Conflict,
                "Status update conflict",
                "You cannot deactivate your own account."),

            InvalidCredentialsException or InactiveUserException
                or ProfileUnavailableException => CreateProblem(
                StatusCodes.Status401Unauthorized,
                "Authentication failed",
                AuthenticationErrorMessage),

            _ => CreateProblem(
                StatusCodes.Status500InternalServerError,
                "An unexpected error occurred",
                "The server encountered an unexpected condition.")
        };
    }

    private static ValidationProblemDetails CreateValidationProblem(
        ValidationException exception)
    {
        var errors = exception.Errors
            .GroupBy(error => error.PropertyName)
            .ToDictionary(
                group => group.Key,
                group => group.Select(error => error.ErrorMessage).ToArray());

        return new ValidationProblemDetails(errors)
        {
            Status = StatusCodes.Status400BadRequest,
            Title = "Validation failed",
            Detail = "One or more validation errors occurred."
        };
    }

    private static ProblemDetails CreateProblem(
        int status,
        string title,
        string detail)
    {
        return new ProblemDetails
        {
            Status = status,
            Title = title,
            Detail = detail
        };
    }
}