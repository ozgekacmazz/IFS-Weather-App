using FluentValidation;
using IFSWeather.Application.Weather.External.Models;

namespace IFSWeather.Application.Weather.External.Validators;

public sealed class ExternalLocationQueryValidator
    : AbstractValidator<ExternalLocationQuery>
{
    public const int MaximumQueryLength = 100;

    public ExternalLocationQueryValidator()
    {
        RuleFor(query => query.Query)
            .NotEmpty()
            .MaximumLength(MaximumQueryLength);
    }
}
