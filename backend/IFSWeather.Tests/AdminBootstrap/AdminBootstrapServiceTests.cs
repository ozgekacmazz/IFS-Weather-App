using IFSWeather.Application.AdminBootstrap.Exceptions;
using IFSWeather.Application.AdminBootstrap.Interfaces;
using IFSWeather.Application.AdminBootstrap.Models;
using IFSWeather.Application.AdminBootstrap.Services;
using IFSWeather.Application.Authentication.Interfaces;
using IFSWeather.Application.Authentication.Validators;
using IFSWeather.Domain.Entities;
using IFSWeather.Domain.Enums;
using Xunit;

namespace IFSWeather.Tests.AdminBootstrap;

public sealed class AdminBootstrapServiceTests
{
    private static readonly DateTime TestUtcNow =
        new(2026, 8, 1, 10, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task DisabledBootstrap_PerformsNoRepositoryOrHashingWork()
    {
        var fixture = CreateFixture();

        var result = await fixture.Service.ExecuteAsync(
            new AdminBootstrapSettings(),
            TestContext.Current.CancellationToken);

        Assert.Equal(AdminBootstrapResult.Disabled, result);
        Assert.Equal(0, fixture.Repository.ExecutionCount);
        Assert.Equal(0, fixture.PasswordHasher.HashCount);
    }

    [Fact]
    public async Task EnabledBootstrap_WithMissingRequiredConfiguration_Fails()
    {
        var fixture = CreateFixture();
        var invalidSettings = new[]
        {
            CreateSettings(username: null),
            CreateSettings(email: " "),
            CreateSettings(password: string.Empty)
        };

        foreach (var settings in invalidSettings)
        {
            await Assert.ThrowsAsync<AdminBootstrapException>(() =>
                fixture.Service.ExecuteAsync(
                    settings,
                    TestContext.Current.CancellationToken));
        }

        Assert.Equal(0, fixture.Repository.ExecutionCount);
        Assert.Equal(0, fixture.PasswordHasher.HashCount);
    }

    [Fact]
    public async Task FirstExecution_CreatesActiveAdministratorWithHashedPassword()
    {
        var fixture = CreateFixture();

        var result = await fixture.Service.ExecuteAsync(
            CreateSettings(
                username: "  bootstrap.admin ",
                email: " ADMIN@EXAMPLE.TEST "),
            TestContext.Current.CancellationToken);

        var administrator = Assert.Single(fixture.Repository.Users);
        Assert.Equal(AdminBootstrapResult.Created, result);
        Assert.Equal("bootstrap.admin", administrator.FirstName);
        Assert.Equal("bootstrap.admin", administrator.LastName);
        Assert.Equal("bootstrap.admin", administrator.Username);
        Assert.Equal("admin@example.test", administrator.Email);
        Assert.Equal("TEST_PASSWORD_HASH", administrator.PasswordHash);
        Assert.Null(administrator.DefaultCity);
        Assert.Equal(UserRole.Admin, administrator.Role);
        Assert.Equal(UserStatus.Active, administrator.Status);
        Assert.NotEqual("FakePassword1", administrator.PasswordHash);
        Assert.Equal(TestUtcNow, administrator.CreatedAt);
        Assert.Equal(TestUtcNow, administrator.UpdatedAt);
        Assert.Equal(0, administrator.FailedLoginAttempts);
        Assert.Null(administrator.LockoutEndUtc);
        Assert.Equal(1, fixture.PasswordHasher.HashCount);
    }

    [Fact]
    public async Task SecondIdenticalExecution_IsNoOpAndDoesNotRehashPassword()
    {
        var fixture = CreateFixture();
        var settings = CreateSettings();

        var firstResult = await fixture.Service.ExecuteAsync(
            settings,
            TestContext.Current.CancellationToken);
        var originalHash = fixture.Repository.Users.Single().PasswordHash;
        var secondResult = await fixture.Service.ExecuteAsync(
            settings,
            TestContext.Current.CancellationToken);

        Assert.Equal(AdminBootstrapResult.Created, firstResult);
        Assert.Equal(AdminBootstrapResult.AlreadyExists, secondResult);
        Assert.Single(fixture.Repository.Users);
        Assert.Equal(originalHash, fixture.Repository.Users.Single().PasswordHash);
        Assert.Equal(1, fixture.PasswordHasher.HashCount);
    }

    [Fact]
    public async Task ExistingAdministrator_IsNoOpAndKeepsOriginalPasswordHash()
    {
        var existingAdministrator = CreateUser(
            "bootstrap.admin",
            "admin@example.test",
            UserRole.Admin,
            "ORIGINAL_HASH");
        var originalState = UserSnapshot.From(existingAdministrator);
        var fixture = CreateFixture(existingAdministrator);

        var result = await fixture.Service.ExecuteAsync(
            CreateSettings(),
            TestContext.Current.CancellationToken);

        Assert.Equal(AdminBootstrapResult.AlreadyExists, result);
        Assert.Equal(originalState, UserSnapshot.From(existingAdministrator));
        Assert.Equal(0, fixture.PasswordHasher.HashCount);
    }

    [Fact]
    public async Task ExistingNonAdminCollision_FailsWithoutChangingAccount()
    {
        var existingUser = CreateUser(
            "bootstrap.admin",
            "admin@example.test",
            UserRole.User,
            "ORIGINAL_HASH");
        var originalState = UserSnapshot.From(existingUser);
        var fixture = CreateFixture(existingUser);

        await Assert.ThrowsAsync<AdminBootstrapException>(() =>
            fixture.Service.ExecuteAsync(
                CreateSettings(),
                TestContext.Current.CancellationToken));

        Assert.Equal(originalState, UserSnapshot.From(existingUser));
        Assert.Equal(0, fixture.PasswordHasher.HashCount);
    }

    [Fact]
    public async Task UsernameAndEmailMatchingDifferentAccounts_FailsWithoutChanges()
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
            "SECOND_HASH",
            2);
        var usernameAccountState = UserSnapshot.From(usernameAccount);
        var emailAccountState = UserSnapshot.From(emailAccount);
        var fixture = CreateFixture(usernameAccount, emailAccount);

        await Assert.ThrowsAsync<AdminBootstrapException>(() =>
            fixture.Service.ExecuteAsync(
                CreateSettings(),
                TestContext.Current.CancellationToken));

        Assert.Equal(usernameAccountState, UserSnapshot.From(usernameAccount));
        Assert.Equal(emailAccountState, UserSnapshot.From(emailAccount));
        Assert.Equal(0, fixture.PasswordHasher.HashCount);
    }

    private static TestFixture CreateFixture(params User[] users)
    {
        var repository = new InMemoryAdminBootstrapRepository(users);
        var passwordHasher = new RecordingPasswordHasher();
        var service = new AdminBootstrapService(
            repository,
            passwordHasher,
            new RegisterRequestValidator(),
            new StubTimeProvider(TestUtcNow));

        return new TestFixture(service, repository, passwordHasher);
    }

    private static AdminBootstrapSettings CreateSettings(
        string? username = "bootstrap.admin",
        string? email = "admin@example.test",
        string? password = "FakePassword1")
    {
        return new AdminBootstrapSettings
        {
            Enabled = true,
            Username = username,
            Email = email,
            Password = password
        };
    }

    private static User CreateUser(
        string username,
        string email,
        UserRole role,
        string passwordHash,
        int id = 1)
    {
        return new User
        {
            Id = id,
            FirstName = "Existing",
            LastName = "User",
            Username = username,
            Email = email,
            PasswordHash = passwordHash,
            Role = role,
            Status = UserStatus.Active
        };
    }

    private sealed record TestFixture(
        AdminBootstrapService Service,
        InMemoryAdminBootstrapRepository Repository,
        RecordingPasswordHasher PasswordHasher);

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

    private sealed class StubTimeProvider : TimeProvider
    {
        private readonly DateTimeOffset _utcNow;

        public StubTimeProvider(DateTime utcNow)
        {
            _utcNow = new DateTimeOffset(utcNow);
        }

        public override DateTimeOffset GetUtcNow() => _utcNow;
    }

    private sealed class RecordingPasswordHasher : IPasswordHasher
    {
        public int HashCount { get; private set; }

        public string HashPassword(User user, string password)
        {
            HashCount++;
            return "TEST_PASSWORD_HASH";
        }

        public bool VerifyPassword(
            User user,
            string passwordHash,
            string providedPassword) =>
            throw new NotSupportedException();
    }

    private sealed class InMemoryAdminBootstrapRepository
        : IAdminBootstrapRepository
    {
        public InMemoryAdminBootstrapRepository(IEnumerable<User> users)
        {
            Users = users.ToList();
        }

        public List<User> Users { get; }

        public int ExecutionCount { get; private set; }

        public Task<AdminBootstrapResult> EnsureAdministratorAsync(
            string username,
            string email,
            Func<User> createAdministrator,
            CancellationToken cancellationToken = default)
        {
            ExecutionCount++;
            var usernameMatches = Users
                .Where(user => string.Equals(
                    user.Username,
                    username,
                    StringComparison.OrdinalIgnoreCase))
                .ToArray();
            var emailMatches = Users
                .Where(user => string.Equals(
                    user.Email,
                    email,
                    StringComparison.OrdinalIgnoreCase))
                .ToArray();

            if (usernameMatches.Length == 0 && emailMatches.Length == 0)
            {
                Users.Add(createAdministrator());
                return Task.FromResult(AdminBootstrapResult.Created);
            }

            if (usernameMatches.Length == 1
                && emailMatches.Length == 1
                && ReferenceEquals(usernameMatches[0], emailMatches[0])
                && usernameMatches[0].Role is UserRole.Admin)
            {
                return Task.FromResult(AdminBootstrapResult.AlreadyExists);
            }

            throw new AdminBootstrapException(
                "Administrator bootstrap conflicts with existing user identity data.");
        }
    }
}
