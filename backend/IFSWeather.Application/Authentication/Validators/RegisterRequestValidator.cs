using FluentValidation;
using IFSWeather.Application.Authentication.DTOs;

namespace IFSWeather.Application.Authentication.Validators;

public sealed class RegisterRequestValidator : AbstractValidator<RegisterRequest>
{
    private const string UsernamePattern = "^[a-zA-Z0-9_.-]+$";
    private const string UppercasePattern = "[A-Z]";
    private const string LowercasePattern = "[a-z]";
    private const string DigitPattern = "[0-9]";

    public RegisterRequestValidator()
    {
        RuleFor(request => request.FirstName)
            .NotEmpty()
            .MaximumLength(100);

        RuleFor(request => request.LastName)
            .NotEmpty()
            .MaximumLength(100);

        RuleFor(request => request.Username)
            .NotEmpty()
            .MinimumLength(3)
            .MaximumLength(50)
            .Matches(UsernamePattern);

        RuleFor(request => request.Email)
            .NotEmpty()
            .EmailAddress()
            .MaximumLength(256);

        RuleFor(request => request.Password)
            .NotEmpty()
            .MinimumLength(8)
            .Matches(UppercasePattern)
            .Matches(LowercasePattern)
            .Matches(DigitPattern);

        RuleFor(request => request.DefaultCity)
            .MaximumLength(100);
    }
}
