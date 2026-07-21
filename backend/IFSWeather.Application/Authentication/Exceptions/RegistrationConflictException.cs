namespace IFSWeather.Application.Authentication.Exceptions;

public sealed class RegistrationConflictException : Exception
{
    public RegistrationConflictException()
        : base("A user with the same username or email already exists.")
    {
    }
}
