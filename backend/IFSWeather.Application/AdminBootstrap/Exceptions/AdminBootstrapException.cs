namespace IFSWeather.Application.AdminBootstrap.Exceptions;

public sealed class AdminBootstrapException : Exception
{
    public AdminBootstrapException(string message)
        : base(message)
    {
    }
}
