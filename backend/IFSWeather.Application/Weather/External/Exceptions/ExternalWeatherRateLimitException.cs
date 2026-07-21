namespace IFSWeather.Application.Weather.External.Exceptions;

public sealed class ExternalWeatherRateLimitException : Exception
{
    public ExternalWeatherRateLimitException()
        : base("The external weather service request limit has been reached.")
    {
    }
}
