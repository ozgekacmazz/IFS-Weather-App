namespace IFSWeather.Application.Admin.Users.Exceptions;

public sealed class AdminUserNotFoundException : Exception
{
    public AdminUserNotFoundException()
        : base("The requested user could not be found.")
    {
    }
}
