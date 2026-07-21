using FluentValidation;
using IFSWeather.Application.Profile.DTOs;

namespace IFSWeather.Application.Profile.Validators;

public sealed class UpdateProfileRequestValidator
    : AbstractValidator<UpdateProfileRequest>
{
    private const string UppercasePattern = "[A-Z]";
    private const string LowercasePattern = "[a-z]";
    private const string DigitPattern = "[0-9]";

    public UpdateProfileRequestValidator()
    {
        RuleFor(request => request.FirstName)
            .NotEmpty()
            .MaximumLength(100);

        RuleFor(request => request.LastName)
            .NotEmpty()
            .MaximumLength(100);

        RuleFor(request => request.DefaultCity)
            .MaximumLength(100);

        When(
            request => !string.IsNullOrEmpty(request.NewPassword),
            () =>
            {
                RuleFor(request => request.CurrentPassword)
                    .NotEmpty()
                    .WithMessage(
                        "Current password is required when setting a new password.");

                RuleFor(request => request.NewPassword)
                    .MinimumLength(8)
                    .Matches(UppercasePattern)
                    .Matches(LowercasePattern)
                    .Matches(DigitPattern);
            });
    }
}
