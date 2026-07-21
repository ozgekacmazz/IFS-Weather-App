using IFSWeather.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IFSWeather.Infrastructure.Persistence.Configurations;

public sealed class UserLoginLogConfiguration
    : IEntityTypeConfiguration<UserLoginLog>
{
    public void Configure(EntityTypeBuilder<UserLoginLog> builder)
    {
        builder.ToTable("USER_LOG_TAB");

        builder.HasKey(loginLog => loginLog.LogId);

        builder.Property(loginLog => loginLog.LogId)
            .ValueGeneratedOnAdd();

        builder.Property(loginLog => loginLog.Username)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(loginLog => loginLog.LogTime)
            .IsRequired();

        builder.Property(loginLog => loginLog.IPAddress)
            .HasMaxLength(45);

        builder.Property(loginLog => loginLog.Log)
            .HasMaxLength(200)
            .IsRequired();
    }
}
