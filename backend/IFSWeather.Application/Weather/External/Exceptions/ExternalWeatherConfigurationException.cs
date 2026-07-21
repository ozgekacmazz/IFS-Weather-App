namespace IFSWeather.Application.Weather.External.Exceptions;

public sealed class ExternalWeatherConfigurationException : Exception
{
    public ExternalWeatherConfigurationException()
        : base("The external weather service is not configured correctly.")
    {
    }
}
