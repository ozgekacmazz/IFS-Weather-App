using FluentValidation;
using IFSWeather.Application.Weather.Models;

namespace IFSWeather.Application.Weather.Validators;

public sealed class CurrentWeatherQueryValidator : AbstractValidator<CurrentWeatherQuery>
{
    public CurrentWeatherQueryValidator()
    {
        RuleFor(query => query.City)
            .Must(city => city is null || city.Length is >= 2 and <= 100)
            .WithMessage("City must contain between 2 and 100 characters.");
    }
}
