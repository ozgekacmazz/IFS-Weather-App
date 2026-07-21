using FluentValidation;
using IFSWeather.Application.Weather.External.Models;

namespace IFSWeather.Application.Weather.External.Validators;

public sealed class ExternalForecastQueryValidator
    : AbstractValidator<ExternalForecastQuery>
{
    public ExternalForecastQueryValidator()
    {
        RuleFor(query => query.City)
            .NotEmpty()
            .Length(2, 100);

        RuleFor(query => query.Days)
            .InclusiveBetween(1, 3);
    }
}
