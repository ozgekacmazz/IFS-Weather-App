namespace IFSWeather.Application.Weather.Exceptions;

public sealed class DefaultCityUnavailableException : Exception
{
    public DefaultCityUnavailableException()
        : base("A default city is required to retrieve weather information.")
    {
    }
}
