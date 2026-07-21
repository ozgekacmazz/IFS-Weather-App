namespace IFSWeather.Application.Authentication.Exceptions;

public sealed class InvalidCredentialsException : Exception
{
    public InvalidCredentialsException()
        : base("The supplied credentials are invalid.")
    {
    }
}
