namespace IFSWeather.Application.Weather.Exceptions;

public sealed class WeatherNotFoundException : Exception
{
    public WeatherNotFoundException()
        : base("The requested weather record could not be found.")
    {
    }
}
