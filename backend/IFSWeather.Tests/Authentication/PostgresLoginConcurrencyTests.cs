using System.Collections.Concurrent;
using IFSWeather.Application.Authentication.DTOs;
using IFSWeather.Application.Authentication.Exceptions;
using IFSWeather.Application.Authentication.Interfaces;
using IFSWeather.Application.Authentication.Models;
using IFSWeather.Application.Authentication.Services;
using IFSWeather.Application.Authentication.Validators;
using IFSWeather.Domain.Entities;
using IFSWeather.Domain.Enums;
using IFSWeather.Infrastructure.Authentication;
using IFSWeather.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace IFSWeather.Tests.Authentication;

public sealed class PostgresLoginConcurrencyTests
{
    private const string TestConnectionStringEnvironmentVariable =
        "IFSWEATHER_TEST_ADMIN_CONNECTION_STRING";

    private static readonly DateTime TestUtcNow =
        new(2026, 7, 22, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public Task ThreeOverlappingFailures_AreSerializedAndLockTheAccount()
    {
        return RunWithDatabaseAsync(async database =>
        {
            await database.AddUserAsync(CreateUser());

            var passwordHasher = new CoordinatedPasswordHasher();
            var firstAttempt = Task.Run(() => database.LoginAsync("wrong", passwordHasher));

            await passwordHasher.FirstVerificationEntered.Task.WaitAsync(TimeSpan.FromSeconds(10));

            var secondAttempt = Task.Run(() => database.LoginAsync("wrong", passwordHasher));
            var thirdAttempt = Task.Run(() => database.LoginAsync("wrong", passwordHasher));

            try
            {
                await database.WaitForBlockedLoginTransactionsAsync(2);
            }
            finally
            {
                passwordHasher.ReleaseFirstVerification();
            }

            await AssertInvalidCredentialsAsync(firstAttempt, secondAttempt, thirdAttempt);

            var user = await database.GetUserAsync();
            Assert.Equal(3, user.FailedLoginAttempts);
            Assert.Equal(TestUtcNow.AddMinutes(1), user.LockoutEndUtc);
        });
    }

    [Fact]
    public Task ConcurrentSuccess_CannotClearANewerLock()
    {
        return RunWithDatabaseAsync(async database =>
        {
            await database.AddUserAsync(CreateUser(failedLoginAttempts: 2));

            var passwordHasher = new CoordinatedPasswordHasher();
            var lockingFailure = Task.Run(() => database.LoginAsync("wrong", passwordHasher));

            await passwordHasher.FirstVerificationEntered.Task.WaitAsync(TimeSpan.FromSeconds(10));

            var correctAttempt = Task.Run(() => database.LoginAsync("correct", passwordHasher));

            try
            {
                await database.WaitForBlockedLoginTransactionsAsync(1);
            }
            finally
            {
                passwordHasher.ReleaseFirstVerification();
            }

            await AssertInvalidCredentialsAsync(lockingFailure, correctAttempt);

            var user = await database.GetUserAsync();
            Assert.Equal(3, user.FailedLoginAttempts);
            Assert.Equal(TestUtcNow.AddMinutes(1), user.LockoutEndUtc);
        });
    }

    [Fact]
    public Task ConcurrentFailure_ObservesANewerSuccessfulReset()
    {
        return RunWithDatabaseAsync(async database =>
        {
            await database.AddUserAsync(CreateUser(failedLoginAttempts: 2));

            var passwordHasher = new CoordinatedPasswordHasher();
            var successfulAttempt = Task.Run(() => database.LoginAsync("correct", passwordHasher));

            await passwordHasher.FirstVerificationEntered.Task.WaitAsync(TimeSpan.FromSeconds(10));

            var failedAttempt = Task.Run(() => database.LoginAsync("wrong", passwordHasher));

            try
            {
                await database.WaitForBlockedLoginTransactionsAsync(1);
            }
            finally
            {
                passwordHasher.ReleaseFirstVerification();
            }

            var response = await successfulAttempt;
            await Assert.ThrowsAsync<InvalidCredentialsException>(() => failedAttempt);

            Assert.Equal(42, response.UserId);

            var user = await database.GetUserAsync();
            Assert.Equal(1, user.FailedLoginAttempts);
            Assert.Null(user.LockoutEndUtc);
        });
    }

    private static async Task RunWithDatabaseAsync(Func<TestDatabase, Task> test)
    {
        var adminConnectionString = Environment.GetEnvironmentVariable(
            TestConnectionStringEnvironmentVariable);

        Assert.False(
            string.IsNullOrWhiteSpace(adminConnectionString),
            $"{TestConnectionStringEnvironmentVariable} must be configured.");

        var databaseName = $"ifsweather_lockout_test_{Guid.NewGuid():N}";
        var adminBuilder = new NpgsqlConnectionStringBuilder(adminConnectionString)
        {
            Database = "postgres",
            Pooling = false
        };
        var testBuilder = new NpgsqlConnectionStringBuilder(adminConnectionString)
        {
            Database = databaseName,
            ApplicationName = databaseName,
            Pooling = false
        };

        await using var adminConnection = new NpgsqlConnection(adminBuilder.ConnectionString);
        await adminConnection.OpenAsync();

        var quotedDatabaseName = new NpgsqlCommandBuilder()
            .QuoteIdentifier(databaseName);

        await using (var createCommand = adminConnection.CreateCommand())
        {
            createCommand.CommandText = $"CREATE DATABASE {quotedDatabaseName}";
            await createCommand.ExecuteNonQueryAsync();
        }

        try
        {
            var database = new TestDatabase(
                testBuilder.ConnectionString,
                adminBuilder.ConnectionString,
                databaseName);

            await database.InitializeAsync();
            await test(database);
        }
        finally
        {
            NpgsqlConnection.ClearAllPools();

            await using var dropCommand = adminConnection.CreateCommand();
            dropCommand.CommandText = $"DROP DATABASE {quotedDatabaseName} WITH (FORCE)";
            await dropCommand.ExecuteNonQueryAsync();
        }
    }

    private static async Task AssertInvalidCredentialsAsync(params Task[] attempts)
    {
        foreach (var attempt in attempts)
        {
            await Assert.ThrowsAsync<InvalidCredentialsException>(() => attempt);
        }
    }

    private static User CreateUser(int failedLoginAttempts = 0)
    {
        return new User
        {
            Id = 42,
            FirstName = "Concurrent",
            LastName = "User",
            Username = "concurrent-user",
            Email = "concurrent@example.com",
            PasswordHash = "correct",
            Role = UserRole.User,
            Status = UserStatus.Active,
            FailedLoginAttempts = failedLoginAttempts,
            CreatedAt = TestUtcNow.AddDays(-1),
            UpdatedAt = TestUtcNow.AddDays(-1)
        };
    }

    private sealed class TestDatabase
    {
        private readonly string _connectionString;
        private readonly string _adminConnectionString;
        private readonly string _applicationName;
        private readonly FixedTimeProvider _timeProvider = new(TestUtcNow);
        private readonly RecordingAuditService _auditService = new();
        private readonly RecordingTokenService _tokenService = new();

        public TestDatabase(
            string connectionString,
            string adminConnectionString,
            string applicationName)
        {
            _connectionString = connectionString;
            _adminConnectionString = adminConnectionString;
            _applicationName = applicationName;
        }

        public async Task InitializeAsync()
        {
            await using var context = CreateContext();
            await context.Database.EnsureCreatedAsync();
        }

        public async Task AddUserAsync(User user)
        {
            await using var context = CreateContext();
            context.Users.Add(user);
            await context.SaveChangesAsync();
        }

        public async Task<AuthenticationResponse> LoginAsync(
            string password,
            IPasswordHasher passwordHasher)
        {
            await using var context = CreateContext();
            var service = new AuthenticationService(
                new UserRepository(context),
                passwordHasher,
                _tokenService,
                _auditService,
                _timeProvider,
                new RegisterRequestValidator(),
                new LoginRequestValidator());

            return await service.LoginAsync(
                new LoginRequest("concurrent-user", password),
                null);
        }

        public async Task<User> GetUserAsync()
        {
            await using var context = CreateContext();
            return await context.Users.AsNoTracking().SingleAsync();
        }

        public async Task WaitForBlockedLoginTransactionsAsync(int expectedCount)
        {
            await using var connection = new NpgsqlConnection(_adminConnectionString);
            await connection.OpenAsync();

            for (var attempt = 0; attempt < 200; attempt++)
            {
                await using var command = connection.CreateCommand();
                command.CommandText = """
                    SELECT count(*)
                    FROM pg_stat_activity
                    WHERE application_name = @applicationName
                      AND wait_event_type = 'Lock'
                    """;
                command.Parameters.AddWithValue("applicationName", _applicationName);

                var blockedCount = Convert.ToInt32(await command.ExecuteScalarAsync());

                if (blockedCount >= expectedCount)
                {
                    return;
                }

                await Task.Delay(25);
            }

            throw new TimeoutException(
                $"Expected {expectedCount} login transaction(s) to wait for the user row lock.");
        }

        private AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseNpgsql(_connectionString)
                .Options;

            return new AppDbContext(options);
        }
    }

    private sealed class CoordinatedPasswordHasher : IPasswordHasher
    {
        private readonly TaskCompletionSource _releaseFirstVerification =
            new(TaskCreationOptions.RunContinuationsAsynchronously);
        private int _verificationCount;

        public TaskCompletionSource FirstVerificationEntered { get; } =
            new(TaskCreationOptions.RunContinuationsAsynchronously);

        public string HashPassword(User user, string password) => password;

        public bool VerifyPassword(User user, string passwordHash, string providedPassword)
        {
            if (Interlocked.Increment(ref _verificationCount) == 1)
            {
                FirstVerificationEntered.TrySetResult();
                _releaseFirstVerification.Task.GetAwaiter().GetResult();
            }

            return passwordHash == providedPassword;
        }

        public void ReleaseFirstVerification()
        {
            _releaseFirstVerification.TrySetResult();
        }
    }

    private sealed class FixedTimeProvider : TimeProvider
    {
        private readonly DateTimeOffset _utcNow;

        public FixedTimeProvider(DateTime utcNow)
        {
            _utcNow = new DateTimeOffset(utcNow);
        }

        public override DateTimeOffset GetUtcNow() => _utcNow;
    }

    private sealed class RecordingAuditService : ILoginAuditService
    {
        public ConcurrentQueue<LoginAuditOutcome> Outcomes { get; } = new();

        public Task RecordAsync(
            string username,
            string? ipAddress,
            LoginAuditOutcome outcome,
            CancellationToken cancellationToken = default)
        {
            Outcomes.Enqueue(outcome);
            return Task.CompletedTask;
        }
    }

    private sealed class RecordingTokenService : ITokenService
    {
        public Task<TokenResult> GenerateTokenAsync(
            User user,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(new TokenResult("token", TestUtcNow.AddHours(1)));
        }
    }
}
