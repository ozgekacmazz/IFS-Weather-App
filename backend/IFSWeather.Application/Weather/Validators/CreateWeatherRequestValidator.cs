using FluentValidation;
using IFSWeather.Application.Weather.DTOs;

namespace IFSWeather.Application.Weather.Validators;

public sealed class CreateWeatherRequestValidator
    : AbstractValidator<CreateWeatherRequest>
{
    public CreateWeatherRequestValidator()
    {
        RuleFor(request => request.WeatherDate)
            .NotEqual(default(DateOnly));

        RuleFor(request => request.CityName)
            .NotEmpty()
            .Must(value => value.Trim().Length is >= 2 and <= 100)
            .WithMessage("City name must contain between 2 and 100 characters.");

        RuleFor(request => request.Temperature)
            .InclusiveBetween(-90m, 60m);

        RuleFor(request => request.MainStatus)
            .NotEmpty()
            .Must(value => value.Trim().Length is >= 2 and <= 50)
            .WithMessage("Main status must contain between 2 and 50 characters.");
    }
}
