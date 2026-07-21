namespace IFSWeather.Application.Admin.Users.Exceptions;

public sealed class AdminSelfDeactivationException : Exception
{
    public AdminSelfDeactivationException()
        : base("Administrators cannot deactivate their own account.")
    {
    }
}
