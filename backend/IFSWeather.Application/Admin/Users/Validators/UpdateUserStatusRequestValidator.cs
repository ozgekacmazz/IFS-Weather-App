using FluentValidation;
using IFSWeather.Application.Admin.Users.DTOs;

namespace IFSWeather.Application.Admin.Users.Validators;

public sealed class UpdateUserStatusRequestValidator
    : AbstractValidator<UpdateUserStatusRequest>
{
    public UpdateUserStatusRequestValidator()
    {
        RuleFor(request => request.Status)
            .IsInEnum();
    }
}
