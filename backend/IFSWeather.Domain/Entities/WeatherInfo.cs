using IFSWeather.Domain.Common;

namespace IFSWeather.Domain.Entities;

public sealed class WeatherInfo : BaseEntity
{
    public DateOnly WeatherDate { get; set; }

    public required string CityName { get; set; }

    public decimal Temperature { get; set; }

    public required string MainStatus { get; set; }
}
