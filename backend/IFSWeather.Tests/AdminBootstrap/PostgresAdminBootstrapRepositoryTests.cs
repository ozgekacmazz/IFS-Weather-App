using IFSWeather.Application.AdminBootstrap.Exceptions;
using IFSWeather.Application.AdminBootstrap.Models;
using IFSWeather.Application.AdminBootstrap.Services;
using IFSWeather.Application.Authentication.Validators;
using IFSWeather.Domain.Entities;
using IFSWeather.Domain.Enums;
using IFSWeather.Infrastructure.Authentication;
using IFSWeather.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace IFSWeather.Tests.AdminBootstrap;

public sealed class PostgresAdminBootstrapRepositoryTests
{
    private const string TestConnectionStringEnvironmentVariable =
        "IFSWEATHER_TEST_ADMIN_CONNECTION_STRING";
    private const string FakePassword = "FakePassword1";

    private static readonly DateTime TestUtcNow =
        new(2026, 8, 1, 10, 0, 0, DateTimeKind.Utc);

    [Fact]
    public Task FirstAndSecondExecution_CreateOnceThenPreserveAdministrator()
    {
        return RunWithDatabaseAsync(async database =>
        {
            var settings = CreateSettings();

            var firstResult = await database.BootstrapAsync(settings);
            var createdAdministrator = Assert.Single(await database.GetUsersAsync());
            var createdState = UserSnapshot.From(createdAdministrator);
            var secondResult = await database.BootstrapAsync(settings);
            var persistedAdministrator = Assert.Single(await database.GetUsersAsync());

            Assert.Equal(AdminBootstrapResult.Created, firstResult);
            Assert.Equal(AdminBootstrapResult.AlreadyExists, secondResult);
            Assert.Equal(createdState, UserSnapshot.From(persistedAdministrator));
            Assert.Equal(UserRole.Admin, persistedAdministrator.Role);
            Assert.NotEqual(FakePassword, persistedAdministrator.PasswordHash);
            Assert.True(new PasswordHasher().VerifyPassword(
                persistedAdministrator,
                persistedAdministrator.PasswordHash,
                FakePassword));
        });
    }

    [Fact]
    public Task ConcurrentIdenticalExecutions_LeaveExactlyOneAdministrator()
    {
        return RunWithDatabaseAsync(async database =>
        {
            var settings = CreateSettings();
            var results = await Task.WhenAll(
                database.BootstrapAsync(settings),
                database.BootstrapAsync(settings));

            var administrator = Assert.Single(await database.GetUsersAsync());
            Assert.Contains(AdminBootstrapResult.Created, results);
            Assert.Contains(AdminBootstrapResult.AlreadyExists, results);
            Assert.Equal(UserRole.Admin, administrator.Role);
        });
    }

    [Fact]
    public Task CaseInsensitiveIdentityMatch_IsIdempotentAndPreservesEveryField()
    {
        return RunWithDatabaseAsync(async database =>
        {
            var existingAdministrator = CreateUser(
                "Case.Admin",
                "Case.Admin@Example.Test",
                UserRole.Admin,
                "ORIGINAL_HASH");
            await database.AddUsersAsync(existingAdministrator);
            var originalState = UserSnapshot.From(existingAdministrator);

            var result = await database.BootstrapAsync(CreateSettings(
                "case.admin",
                "case.admin@example.test"));
            var persistedAdministrator = Assert.Single(await database.GetUsersAsync());

            Assert.Equal(AdminBootstrapResult.AlreadyExists, result);
            Assert.Equal(originalState, UserSnapshot.From(persistedAdministrator));
        });
    }

    [Theory]
    [InlineData("%", "X")]
    [InlineData("_", "X")]
    [InlineData("\\", "")]
    public Task LikeMetacharacters_AreMatchedLiterally(
        string metacharacter,
        string replacement)
    {
        return RunWithDatabaseAsync(async database =>
        {
            var configuredUsername = $"literal{metacharacter}admin";
            var configuredEmail = $"literal{metacharacter}mail@example.test";
            var existingUser = CreateUser(
                $"literal{replacement}admin",
                $"literal{replacement}mail@example.test",
                UserRole.User,
                "EXISTING_HASH");
            await database.AddUsersAsync(existingUser);

            var result = await database.EnsureAdministratorAsync(
                configuredUsername,
                configuredEmail,
                () => CreateUser(
                    configuredUsername,
                    configuredEmail,
                    UserRole.Admin,
                    "NEW_HASH"));
            var users = await database.GetUsersAsync();

            Assert.Equal(AdminBootstrapResult.Created, result);
            Assert.Equal(2, users.Count);
            Assert.Contains(users, user => user.Username == configuredUsername);
            Assert.Contains(users, user => user.Username == existingUser.Username);
        });
    }

    [Fact]
    public Task ExistingNonAdminCollision_FailsWithoutChangingUser()
    {
        return RunWithDatabaseAsync(async database =>
        {
            var existingUser = CreateUser(
                "bootstrap.admin",
                "admin@example.test",
                UserRole.User,
                "ORIGINAL_HASH");
            await database.AddUsersAsync(existingUser);
            var originalState = UserSnapshot.From(existingUser);

            await Assert.ThrowsAsync<AdminBootstrapException>(() =>
                database.BootstrapAsync(CreateSettings()));
            var persistedUser = Assert.Single(await database.GetUsersAsync());

            Assert.Equal(originalState, UserSnapshot.From(persistedUser));
        });
    }

    [Fact]
    public Task SplitUsernameAndEmailMatch_FailsWithoutChangingEitherUser()
    {
        return RunWithDatabaseAsync(async database =>
        {
            var usernameAccount = CreateUser(
                "bootstrap.admin",
                "first@example.test",
                UserRole.Admin,
                "FIRST_HASH");
            var emailAccount = CreateUser(
                "other.admin",
                "admin@example.test",
                UserRole.Admin,
                "SECOND_HASH");
            await database.AddUsersAsync(usernameAccount, emailAccount);
            var originalStates = new[]
            {
                UserSnapshot.From(usernameAccount),
                UserSnapshot.From(emailAccount)
            };

            await Assert.ThrowsAsync<AdminBootstrapException>(() =>
                database.BootstrapAsync(CreateSettings()));
            var persistedStates = (await database.GetUsersAsync())
                .OrderBy(user => user.Username)
                .Select(UserSnapshot.From)
                .ToArray();

            Assert.Equal(
                originalStates.OrderBy(user => user.Username),
                persistedStates);
        });
    }

    [Theory]
    [InlineData(AdminBootstrapRepository.UsernameUniqueConstraintName, true)]
    [InlineData(AdminBootstrapRepository.EmailUniqueConstraintName, true)]
    [InlineData("IX_UNRELATED_UNIQUE_CONSTRAINT", false)]
    [InlineData(null, false)]
    public void IdentityConstraintClassification_RecognizesOnlyExpectedNames(
        string? constraintName,
        bool expected)
    {
        Assert.Equal(
            expected,
            AdminBootstrapRepository.IsIdentityUniqueConstraint(constraintName));
    }

    private static async Task RunWithDatabaseAsync(Func<TestDatabase, Task> test)
    {
        var adminConnectionString = Environment.GetEnvironmentVariable(
            TestConnectionStringEnvironmentVariable);

        Assert.False(
            string.IsNullOrWhiteSpace(adminConnectionString),
            $"{TestConnectionStringEnvironmentVariable} must be configured.");

        var databaseName = $"ifsweather_admin_bootstrap_test_{Guid.NewGuid():N}";
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

        await using var adminConnection = new NpgsqlConnection(
            adminBuilder.ConnectionString);
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
            var database = new TestDatabase(testBuilder.ConnectionString);
            await database.InitializeAsync();
            await test(database);
        }
        finally
        {
            NpgsqlConnection.ClearAllPools();

            await using var dropCommand = adminConnection.CreateCommand();
            dropCommand.CommandText =
                $"DROP DATABASE {quotedDatabaseName} WITH (FORCE)";
            await dropCommand.ExecuteNonQueryAsync();
        }
    }

    private static AdminBootstrapSettings CreateSettings(
        string username = "bootstrap.admin",
        string email = "admin@example.test")
    {
        return new AdminBootstrapSettings
        {
            Enabled = true,
            Username = username,
            Email = email,
            Password = FakePassword
        };
    }

    private static User CreateUser(
        string username,
        string email,
        UserRole role,
        string passwordHash)
    {
        return new User
        {
            FirstName = "Test",
            LastName = "Account",
            Username = username,
            Email = email,
            PasswordHash = passwordHash,
            DefaultCity = "Test City",
            Role = role,
            Status = UserStatus.Active,
            FailedLoginAttempts = 2,
            LockoutEndUtc = TestUtcNow.AddMinutes(1),
            CreatedAt = TestUtcNow.AddDays(-2),
            UpdatedAt = TestUtcNow.AddDays(-1)
        };
    }

    private sealed record UserSnapshot(
        int Id,
        string FirstName,
        string LastName,
        string Username,
        string Email,
        string PasswordHash,
        string? DefaultCity,
        UserRole Role,
        UserStatus Status,
        DateTime CreatedAt,
        DateTime UpdatedAt,
        int FailedLoginAttempts,
        DateTime? LockoutEndUtc)
    {
        public static UserSnapshot From(User user)
        {
            return new UserSnapshot(
                user.Id,
                user.FirstName,
                user.LastName,
                user.Username,
                user.Email,
                user.PasswordHash,
                user.DefaultCity,
                user.Role,
                user.Status,
                user.CreatedAt,
                user.UpdatedAt,
                user.FailedLoginAttempts,
                user.LockoutEndUtc);
        }
    }

    private sealed class TestDatabase
    {
        private readonly string _connectionString;

        public TestDatabase(string connectionString)
        {
            _connectionString = connectionString;
        }

        public async Task InitializeAsync()
        {
            await using var context = CreateContext();
            await context.Database.EnsureCreatedAsync();
        }

        public async Task AddUsersAsync(params User[] users)
        {
            await using var context = CreateContext();
            context.Users.AddRange(users);
            await context.SaveChangesAsync();
        }

        public async Task<AdminBootstrapResult> BootstrapAsync(
            AdminBootstrapSettings settings)
        {
            await using var context = CreateContext();
            var service = new AdminBootstrapService(
                new AdminBootstrapRepository(context),
                new PasswordHasher(),
                new RegisterRequestValidator(),
                new FixedTimeProvider(TestUtcNow));

            return await service.ExecuteAsync(settings);
        }

        public async Task<AdminBootstrapResult> EnsureAdministratorAsync(
            string username,
            string email,
            Func<User> createAdministrator)
        {
            await using var context = CreateContext();
            var repository = new AdminBootstrapRepository(context);
            return await repository.EnsureAdministratorAsync(
                username,
                email,
                createAdministrator);
        }

        public async Task<IReadOnlyList<User>> GetUsersAsync()
        {
            await using var context = CreateContext();
            return await context.Users
                .AsNoTracking()
                .OrderBy(user => user.Id)
                .ToListAsync();
        }

        private AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseNpgsql(_connectionString)
                .Options;

            return new AppDbContext(options);
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
}
