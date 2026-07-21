namespace IFSWeather.Application.Weather.Exceptions;

public sealed class WeatherConflictException : Exception
{
    public WeatherConflictException()
        : base("A weather record already exists for the specified city and date.")
    {
    }
}
