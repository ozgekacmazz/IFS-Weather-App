using FluentValidation;
using IFSWeather.Application.Authentication.DTOs;

namespace IFSWeather.Application.Authentication.Validators;

public sealed class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(request => request.UsernameOrEmail)
            .NotEmpty();

        RuleFor(request => request.Password)
            .NotEmpty();
    }
}
