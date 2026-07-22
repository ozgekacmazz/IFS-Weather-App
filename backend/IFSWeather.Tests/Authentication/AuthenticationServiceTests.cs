using IFSWeather.Application.Authentication.DTOs;
using IFSWeather.Application.Authentication.Exceptions;
using IFSWeather.Application.Authentication.Interfaces;
using IFSWeather.Application.Authentication.Models;
using IFSWeather.Application.Authentication.Services;
using IFSWeather.Application.Authentication.Validators;
using IFSWeather.Domain.Entities;
using IFSWeather.Domain.Enums;
using IFSWeather.Infrastructure.Authentication;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace IFSWeather.Tests.Authentication;

public sealed class AuthenticationServiceTests
{
    private static readonly DateTime TestUtcNow =
        new(2026, 7, 22, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task FirstFailedAttempt_PersistsCountOneWithoutLock()
    {
        var fixture = CreateFixture();

        await Assert.ThrowsAsync<InvalidCredentialsException>(() => fixture.LoginAsync("wrong"));

        Assert.Equal(1, fixture.User.FailedLoginAttempts);
        Assert.Null(fixture.User.LockoutEndUtc);
        Assert.Equal(LoginAuditOutcome.Failed, fixture.Audit.Outcomes.Single());
    }

    [Fact]
    public async Task SecondFailedAttempt_PersistsCountTwoWithoutLock()
    {
        var fixture = CreateFixture(failedLoginAttempts: 1);

        await Assert.ThrowsAsync<InvalidCredentialsException>(() => fixture.LoginAsync("wrong"));

        Assert.Equal(2, fixture.User.FailedLoginAttempts);
        Assert.Null(fixture.User.LockoutEndUtc);
    }

    [Fact]
    public async Task ThirdFailedAttempt_LocksForOneMinute()
    {
        var fixture = CreateFixture(failedLoginAttempts: 2);

        await Assert.ThrowsAsync<InvalidCredentialsException>(() => fixture.LoginAsync("wrong"));

        Assert.Equal(3, fixture.User.FailedLoginAttempts);
        Assert.Equal(TestUtcNow.AddMinutes(1), fixture.User.LockoutEndUtc);
        Assert.Equal(LoginAuditOutcome.Locked, fixture.Audit.Outcomes.Single());
    }

    [Fact]
    public async Task ActiveLock_RejectsCorrectPasswordWithoutVerification()
    {
        var fixture = CreateFixture(
            failedLoginAttempts: 3,
            lockoutEndUtc: TestUtcNow.AddSeconds(1));

        await Assert.ThrowsAsync<InvalidCredentialsException>(() => fixture.LoginAsync("correct"));

        Assert.Equal(0, fixture.PasswordHasher.VerificationCount);
        Assert.Equal(3, fixture.User.FailedLoginAttempts);
        Assert.Equal(TestUtcNow.AddSeconds(1), fixture.User.LockoutEndUtc);
        Assert.Equal(LoginAuditOutcome.Locked, fixture.Audit.Outcomes.Single());
    }

    [Fact]
    public async Task LockAtCurrentInstant_IsExpiredAndAllowsSuccessfulLogin()
    {
        var fixture = CreateFixture(
            failedLoginAttempts: 3,
            lockoutEndUtc: TestUtcNow);

        var response = await fixture.LoginAsync("correct");

        Assert.Equal(fixture.User.Id, response.UserId);
        Assert.Equal(0, fixture.User.FailedLoginAttempts);
        Assert.Null(fixture.User.LockoutEndUtc);
    }

    [Fact]
    public async Task SuccessfulLoginAfterExpiration_ResetsBothFields()
    {
        var fixture = CreateFixture(
            failedLoginAttempts: 3,
            lockoutEndUtc: TestUtcNow.AddTicks(-1));

        await fixture.LoginAsync("correct");

        Assert.Equal(0, fixture.User.FailedLoginAttempts);
        Assert.Null(fixture.User.LockoutEndUtc);
        Assert.Equal(1, fixture.Repository.TransitionSaveCount);
    }

    [Fact]
    public async Task FailedLoginAfterExpiration_StartsNewSequenceAtOne()
    {
        var fixture = CreateFixture(
            failedLoginAttempts: 3,
            lockoutEndUtc: TestUtcNow.AddTicks(-1));

        await Assert.ThrowsAsync<InvalidCredentialsException>(() => fixture.LoginAsync("wrong"));

        Assert.Equal(1, fixture.User.FailedLoginAttempts);
        Assert.Null(fixture.User.LockoutEndUtc);
        Assert.Equal(1, fixture.Repository.TransitionSaveCount);
    }

    [Fact]
    public async Task SuccessfulLoginBeforeThreshold_ResetsPreviousFailures()
    {
        var fixture = CreateFixture(failedLoginAttempts: 2);

        await fixture.LoginAsync("correct");

        Assert.Equal(0, fixture.User.FailedLoginAttempts);
        Assert.Null(fixture.User.LockoutEndUtc);
    }

    [Fact]
    public async Task InactiveUser_IsRejectedWithoutChangingLockoutState()
    {
        var fixture = CreateFixture(
            failedLoginAttempts: 2,
            status: UserStatus.Passive);

        await Assert.ThrowsAsync<InactiveUserException>(() => fixture.LoginAsync("correct"));

        Assert.Equal(2, fixture.User.FailedLoginAttempts);
        Assert.Null(fixture.User.LockoutEndUtc);
        Assert.Equal(0, fixture.PasswordHasher.VerificationCount);
    }

    [Fact]
    public async Task AuditPersistenceFailure_DoesNotAlterSuccessfulAuthentication()
    {
        var repository = new InMemoryUserRepository(CreateUser());
        var tokenService = new RecordingTokenService();
        var auditService = new LoginAuditService(
            new FailingLoginLogRepository(),
            new FixedTimeProvider(TestUtcNow),
            NullLogger<LoginAuditService>.Instance);
        var service = CreateService(repository, tokenService, auditService);

        var response = await service.LoginAsync(
            CreateRequest("correct"),
            null,
            TestContext.Current.CancellationToken);

        Assert.Equal(repository.User!.Id, response.UserId);
        Assert.Equal(1, tokenService.GenerationCount);
    }

    [Fact]
    public async Task UserStatePersistenceFailure_PreventsTokenIssuance()
    {
        var fixture = CreateFixture();
        fixture.Repository.ThrowOnTransitionSave = true;

        await Assert.ThrowsAsync<InvalidOperationException>(() => fixture.LoginAsync("correct"));

        Assert.Equal(0, fixture.TokenService.GenerationCount);
        Assert.Empty(fixture.Audit.Outcomes);
    }

    [Fact]
    public async Task FailedAttempt_UsesDeterministicUtcTime()
    {
        var fixture = CreateFixture(failedLoginAttempts: 2);

        await Assert.ThrowsAsync<InvalidCredentialsException>(() => fixture.LoginAsync("wrong"));

        Assert.Equal(DateTimeKind.Utc, fixture.User.UpdatedAt.Kind);
        Assert.Equal(TestUtcNow, fixture.User.UpdatedAt);
        Assert.Equal(TestUtcNow.AddMinutes(1), fixture.User.LockoutEndUtc);
    }

    private static TestFixture CreateFixture(
        int failedLoginAttempts = 0,
        DateTime? lockoutEndUtc = null,
        UserStatus status = UserStatus.Active)
    {
        var user = CreateUser(failedLoginAttempts, lockoutEndUtc, status);
        var repository = new InMemoryUserRepository(user);
        var tokenService = new RecordingTokenService();
        var audit = new RecordingAuditService();
        var passwordHasher = new PlainTextPasswordHasher();
        var service = CreateService(repository, tokenService, audit, passwordHasher);

        return new TestFixture(
            user,
            repository,
            tokenService,
            audit,
            passwordHasher,
            service);
    }

    private static AuthenticationService CreateService(
        IUserRepository repository,
        ITokenService tokenService,
        ILoginAuditService auditService,
        IPasswordHasher? passwordHasher = null)
    {
        return new AuthenticationService(
            repository,
            passwordHasher ?? new PlainTextPasswordHasher(),
            tokenService,
            auditService,
            new FixedTimeProvider(TestUtcNow),
            new RegisterRequestValidator(),
            new LoginRequestValidator());
    }

    private static LoginRequest CreateRequest(string password)
    {
        return new LoginRequest("test-user", password);
    }

    private static User CreateUser(
        int failedLoginAttempts = 0,
        DateTime? lockoutEndUtc = null,
        UserStatus status = UserStatus.Active)
    {
        return new User
        {
            Id = 42,
            FirstName = "Test",
            LastName = "User",
            Username = "test-user",
            Email = "test@example.com",
            PasswordHash = "correct",
            Role = UserRole.User,
            Status = status,
            FailedLoginAttempts = failedLoginAttempts,
            LockoutEndUtc = lockoutEndUtc,
            CreatedAt = TestUtcNow.AddDays(-1),
            UpdatedAt = TestUtcNow.AddDays(-1)
        };
    }

    private sealed record TestFixture(
        User User,
        InMemoryUserRepository Repository,
        RecordingTokenService TokenService,
        RecordingAuditService Audit,
        PlainTextPasswordHasher PasswordHasher,
        AuthenticationService Service)
    {
        public Task<AuthenticationResponse> LoginAsync(string password)
        {
            return Service.LoginAsync(
                CreateRequest(password),
                null,
                TestContext.Current.CancellationToken);
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

    private sealed class PlainTextPasswordHasher : IPasswordHasher
    {
        public int VerificationCount { get; private set; }

        public string HashPassword(User user, string password) => password;

        public bool VerifyPassword(User user, string passwordHash, string providedPassword)
        {
            VerificationCount++;
            return passwordHash == providedPassword;
        }
    }

    private sealed class RecordingTokenService : ITokenService
    {
        public int GenerationCount { get; private set; }

        public Task<TokenResult> GenerateTokenAsync(
            User user,
            CancellationToken cancellationToken = default)
        {
            GenerationCount++;
            return Task.FromResult(new TokenResult("token", TestUtcNow.AddHours(1)));
        }
    }

    private sealed class RecordingAuditService : ILoginAuditService
    {
        public List<LoginAuditOutcome> Outcomes { get; } = [];

        public Task RecordAsync(
            string username,
            string? ipAddress,
            LoginAuditOutcome outcome,
            CancellationToken cancellationToken = default)
        {
            Outcomes.Add(outcome);
            return Task.CompletedTask;
        }
    }

    private sealed class FailingLoginLogRepository : IUserLoginLogRepository
    {
        public Task AddAsync(
            UserLoginLog loginLog,
            CancellationToken cancellationToken = default)
        {
            throw new InvalidOperationException("Expected audit persistence failure.");
        }

        public Task SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            throw new InvalidOperationException("Expected audit persistence failure.");
        }
    }

    private sealed class InMemoryUserRepository : IUserRepository
    {
        public InMemoryUserRepository(User? user)
        {
            User = user;
        }

        public User? User { get; }

        public int TransitionSaveCount { get; private set; }

        public bool ThrowOnTransitionSave { get; set; }

        public Task<TResult?> ExecuteWithUserLockAsync<TResult>(
            string value,
            Func<User, TResult> operation,
            CancellationToken cancellationToken)
            where TResult : class
        {
            if (User is null)
            {
                return Task.FromResult<TResult?>(null);
            }

            var result = operation(User);

            if (ThrowOnTransitionSave)
            {
                throw new InvalidOperationException("Expected user persistence failure.");
            }

            TransitionSaveCount++;
            return Task.FromResult<TResult?>(result);
        }

        public Task<User?> GetByIdAsync(int userId, CancellationToken cancellationToken = default) =>
            Task.FromResult(User);

        public Task<(IReadOnlyList<User> Users, int TotalCount)> GetPagedAsync(
            int pageNumber,
            int pageSize,
            string? search,
            UserStatus? status,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<User?> GetTrackedByIdAsync(
            int userId,
            CancellationToken cancellationToken = default) => Task.FromResult(User);

        public Task<bool> UsernameExistsAsync(string username, CancellationToken cancellationToken) =>
            Task.FromResult(false);

        public Task<bool> EmailExistsAsync(string email, CancellationToken cancellationToken) =>
            Task.FromResult(false);

        public Task AddAsync(User user, CancellationToken cancellationToken) =>
            Task.CompletedTask;

        public Task SaveChangesAsync(CancellationToken cancellationToken) =>
            Task.CompletedTask;
    }
}
