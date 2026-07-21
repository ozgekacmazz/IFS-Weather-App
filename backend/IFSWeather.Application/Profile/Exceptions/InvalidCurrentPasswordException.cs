namespace IFSWeather.Application.Profile.Exceptions;

public sealed class InvalidCurrentPasswordException : Exception
{
    public InvalidCurrentPasswordException()
        : base("The password change request could not be completed.")
    {
    }
}
