namespace IFSWeather.Application.Profile.Exceptions;

public sealed class ProfileUnavailableException : Exception
{
    public ProfileUnavailableException()
        : base("The current user profile could not be resolved.")
    {
    }
}
