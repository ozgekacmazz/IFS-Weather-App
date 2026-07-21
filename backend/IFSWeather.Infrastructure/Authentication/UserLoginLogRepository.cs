using IFSWeather.Application.Authentication.Interfaces;
using IFSWeather.Domain.Entities;
using IFSWeather.Infrastructure.Persistence;

namespace IFSWeather.Infrastructure.Authentication;

public sealed class UserLoginLogRepository : IUserLoginLogRepository
{
    private readonly AppDbContext _dbContext;

    public UserLoginLogRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task AddAsync(
        UserLoginLog loginLog,
        CancellationToken cancellationToken = default)
    {
        await _dbContext.UserLoginLogs.AddAsync(loginLog, cancellationToken);
    }

    public async Task SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}
