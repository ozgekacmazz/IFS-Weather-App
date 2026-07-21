namespace IFSWeather.Application.Common.Interfaces;

public interface ICurrentUserService
{
    int? UserId { get; }

    bool IsAuthenticated { get; }
}
