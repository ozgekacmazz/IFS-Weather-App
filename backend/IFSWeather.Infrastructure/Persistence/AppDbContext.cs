using IFSWeather.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace IFSWeather.Infrastructure.Persistence;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();

    public DbSet<WeatherInfo> WeatherInfos => Set<WeatherInfo>();

    public DbSet<UserLoginLog> UserLoginLogs => Set<UserLoginLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
