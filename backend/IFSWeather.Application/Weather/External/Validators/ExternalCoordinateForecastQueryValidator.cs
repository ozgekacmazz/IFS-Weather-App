using FluentValidation;
using IFSWeather.Application.Weather.External.Models;

namespace IFSWeather.Application.Weather.External.Validators;

public sealed class ExternalCoordinateForecastQueryValidator
    : AbstractValidator<ExternalCoordinateForecastQuery>
{
    public ExternalCoordinateForecastQueryValidator()
    {
        RuleFor(query => query.Latitude)
            .NotNull()
            .InclusiveBetween(-90m, 90m);

        RuleFor(query => query.Longitude)
            .NotNull()
            .InclusiveBetween(-180m, 180m);

        RuleFor(query => query.Days)
            .InclusiveBetween(1, 3);
    }
}
