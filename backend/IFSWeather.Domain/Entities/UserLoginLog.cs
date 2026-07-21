namespace IFSWeather.Domain.Entities;

public sealed class UserLoginLog
{
    public int LogId { get; set; }

    public required string Username { get; set; }

    public DateTime LogTime { get; set; }

    public string? IPAddress { get; set; }

    public required string Log { get; set; }
}
