using FluentValidation;
using IFSWeather.Application.Weather.DTOs;

namespace IFSWeather.Application.Weather.Validators;

public sealed class SaveWeatherPreviewRequestValidator
    : AbstractValidator<SaveWeatherPreviewRequest>
{
    public SaveWeatherPreviewRequestValidator()
    {
        RuleFor(request => request.WeatherDate).NotEqual(default(DateOnly));
        RuleFor(request => request.CityName)
            .NotEmpty()
            .Must(value => value.Trim().Length is >= 2 and <= 100);
        RuleFor(request => request.DisplayLabel)
            .NotEmpty()
            .Must(value => value.Trim().Length is >= 2 and <= 200);
        RuleFor(request => request.Latitude).InclusiveBetween(-90m, 90m);
        RuleFor(request => request.Longitude).InclusiveBetween(-180m, 180m);
        RuleFor(request => request.Temperature).InclusiveBetween(-90m, 60m);
        RuleFor(request => request.MinimumTemperature).InclusiveBetween(-90m, 60m);
        RuleFor(request => request.MaximumTemperature).InclusiveBetween(-90m, 60m);
        RuleFor(request => request.AverageHumidity).InclusiveBetween(0m, 100m);
        RuleFor(request => request.MaximumWindSpeedKph).InclusiveBetween(0m, 500m);
        RuleFor(request => request.PrecipitationProbability)
            .InclusiveBetween(0m, 100m);
        RuleFor(request => request)
            .Must(request =>
                request.MinimumTemperature <= request.MaximumTemperature)
            .WithMessage(
                "Minimum temperature must not exceed maximum temperature.");
        RuleFor(request => request)
            .Must(request =>
                request.Temperature >= request.MinimumTemperature
                && request.Temperature <= request.MaximumTemperature)
            .WithMessage(
                "Temperature must be between minimum and maximum temperature.");
        RuleFor(request => request.MainStatus)
            .NotEmpty()
            .Must(value => value.Trim().Length is >= 2 and <= 50);
    }
}
