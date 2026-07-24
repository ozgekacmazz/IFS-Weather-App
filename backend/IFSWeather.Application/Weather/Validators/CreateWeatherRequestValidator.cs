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

        RuleFor(request => request.MinimumTemperature)
            .InclusiveBetween(-90m, 60m)
            .When(request => request.MinimumTemperature.HasValue);

        RuleFor(request => request.MaximumTemperature)
            .InclusiveBetween(-90m, 60m)
            .When(request => request.MaximumTemperature.HasValue);

        RuleFor(request => request.AverageHumidity)
            .InclusiveBetween(0m, 100m)
            .When(request => request.AverageHumidity.HasValue);

        RuleFor(request => request.MaximumWindSpeedKph)
            .InclusiveBetween(0m, 500m)
            .When(request => request.MaximumWindSpeedKph.HasValue);

        RuleFor(request => request.PrecipitationProbability)
            .InclusiveBetween(0m, 100m)
            .When(request => request.PrecipitationProbability.HasValue);

        RuleFor(request => request)
            .Must(request =>
                request.MinimumTemperature.HasValue
                == request.MaximumTemperature.HasValue)
            .WithMessage(
                "Minimum and maximum temperature must be supplied together.");

        RuleFor(request => request)
            .Must(request =>
                !request.MinimumTemperature.HasValue
                || request.MinimumTemperature <= request.MaximumTemperature)
            .WithMessage(
                "Minimum temperature must not exceed maximum temperature.");

        RuleFor(request => request)
            .Must(request =>
                !request.MinimumTemperature.HasValue
                || request.Temperature >= request.MinimumTemperature
                && request.Temperature <= request.MaximumTemperature)
            .WithMessage(
                "Temperature must be between minimum and maximum temperature.");

        RuleFor(request => request.MainStatus)
            .NotEmpty()
            .Must(value => value.Trim().Length is >= 2 and <= 50)
            .WithMessage("Main status must contain between 2 and 50 characters.");
    }
}
