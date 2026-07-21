using IFSWeather.Domain.Entities;

namespace IFSWeather.Application.Authentication.Interfaces;

public interface IPasswordHasher
{
    string HashPassword(User user, string password);

    bool VerifyPassword(User user, string passwordHash, string providedPassword);
}
