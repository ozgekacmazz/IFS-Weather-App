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
        RuleFor(request => request.MainStatus)
            .NotEmpty()
            .Must(value => value.Trim().Length is >= 2 and <= 50);
    }
}
