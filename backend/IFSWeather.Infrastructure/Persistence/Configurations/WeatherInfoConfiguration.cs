using IFSWeather.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IFSWeather.Infrastructure.Persistence.Configurations;

public sealed class WeatherInfoConfiguration : IEntityTypeConfiguration<WeatherInfo>
{
    public const string CityDateUniqueIndexName =
        "IX_WeatherInfos_WeatherDate_NormalizedCityName";

    private const string NormalizedCityNameProperty = "NormalizedCityName";

    public void Configure(EntityTypeBuilder<WeatherInfo> builder)
    {
        builder.ToTable("WeatherInfos");

        builder.HasKey(weather => weather.Id);

        builder.Property(weather => weather.WeatherDate)
            .IsRequired();

        builder.Property(weather => weather.CityName)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(weather => weather.Temperature)
            .HasPrecision(5, 2)
            .IsRequired();

        builder.Property(weather => weather.MainStatus)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(weather => weather.CreatedAt)
            .IsRequired();

        builder.Property(weather => weather.UpdatedAt)
            .IsRequired();

        builder.Property<string>(NormalizedCityNameProperty)
            .HasMaxLength(100)
            .HasComputedColumnSql("lower(\"CityName\")", stored: true);

        builder.HasIndex(nameof(WeatherInfo.WeatherDate), NormalizedCityNameProperty)
            .HasDatabaseName(CityDateUniqueIndexName)
            .IsUnique();
    }
}
