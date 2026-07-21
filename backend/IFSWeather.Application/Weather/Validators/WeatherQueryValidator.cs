using FluentValidation;
using IFSWeather.Application.Weather.Models;

namespace IFSWeather.Application.Weather.Validators;

public sealed class WeatherQueryValidator : AbstractValidator<WeatherQuery>
{
    public WeatherQueryValidator()
    {
        RuleFor(query => query.PageNumber)
            .GreaterThanOrEqualTo(1);

        RuleFor(query => query.PageSize)
            .InclusiveBetween(1, 100);

        RuleFor(query => query.City)
            .Must(city => city is null || city.Trim().Length <= 100)
            .WithMessage("City must not exceed 100 characters.");
    }
}
