namespace IFSWeather.Application.Authentication.Exceptions;

public sealed class InactiveUserException : Exception
{
    public InactiveUserException()
        : base("The user account is inactive.")
    {
    }
}
