namespace IFSWeather.Application.Weather.External.Exceptions;

public sealed class ExternalWeatherCityNotFoundException : Exception
{
    public ExternalWeatherCityNotFoundException()
        : base("The requested city could not be found by the weather provider.")
    {
    }
}
