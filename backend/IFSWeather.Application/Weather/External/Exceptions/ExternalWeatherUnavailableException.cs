namespace IFSWeather.Application.Weather.External.Exceptions;

public sealed class ExternalWeatherUnavailableException : Exception
{
    public ExternalWeatherUnavailableException()
        : base("The external weather service is currently unavailable.")
    {
    }
}
