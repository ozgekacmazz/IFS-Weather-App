using IFSWeather.Application.Authentication.Interfaces;
using IFSWeather.Application.Authentication.Models;
using IFSWeather.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace IFSWeather.Infrastructure.Authentication;

public sealed class LoginAuditService : ILoginAuditService
{
    private const int MaximumUsernameLength = 50;
    private const int MaximumIpAddressLength = 45;
    private const string LoginSucceededMessage = "User login succeeded.";
    private const string LoginFailedMessage = "User login failed.";
    private const string LoginLockedMessage = "User login rejected because the account is locked.";

    private readonly IUserLoginLogRepository _loginLogRepository;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<LoginAuditService> _logger;

    public LoginAuditService(
        IUserLoginLogRepository loginLogRepository,
        TimeProvider timeProvider,
        ILogger<LoginAuditService> logger)
    {
        _loginLogRepository = loginLogRepository;
        _timeProvider = timeProvider;
        _logger = logger;
    }

    public async Task RecordAsync(
        string username,
        string? ipAddress,
        LoginAuditOutcome outcome,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var loginLog = new UserLoginLog
            {
                Username = Truncate(username, MaximumUsernameLength),
                LogTime = _timeProvider.GetUtcNow().UtcDateTime,
                IPAddress = TruncateOptional(ipAddress, MaximumIpAddressLength),
                Log = outcome switch
                {
                    LoginAuditOutcome.Succeeded => LoginSucceededMessage,
                    LoginAuditOutcome.Locked => LoginLockedMessage,
                    _ => LoginFailedMessage
                }
            };

            await _loginLogRepository.AddAsync(loginLog, cancellationToken);
            await _loginLogRepository.SaveChangesAsync(cancellationToken);
        }
        catch (Exception exception) when (
            exception is not OperationCanceledException
            || !cancellationToken.IsCancellationRequested)
        {
            _logger.LogError(
                "Login audit persistence failed for outcome {AuditOutcome} with {ExceptionType}.",
                outcome,
                exception.GetType().Name);
        }
    }

    private static string Truncate(string value, int maximumLength)
    {
        var normalizedValue = value.Trim();

        return normalizedValue.Length <= maximumLength
            ? normalizedValue
            : normalizedValue[..maximumLength];
    }

    private static string? TruncateOptional(string? value, int maximumLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return Truncate(value, maximumLength);
    }
}
