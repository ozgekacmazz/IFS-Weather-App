# IFS Weather App

IFS Weather is a .NET and React application for authenticated, database-backed
weather management. Administrators can preview live provider data, explicitly
save or update weather records, and users can view saved Today and weekly
weather data for their default city.

## Prerequisites

- .NET 10 SDK
- EF Core CLI (`dotnet-ef`) when initializing a database
- Node.js and npm
- PostgreSQL
- A WeatherAPI account and API key for live search and preview

Real connection strings, JWT secrets, WeatherAPI keys, and account passwords
must be supplied locally through process environment variables or .NET user
secrets. Never commit them to this repository.

## Local configuration

The backend requires these configuration values:

| Configuration | Environment variable |
| --- | --- |
| PostgreSQL connection | `ConnectionStrings__DefaultConnection` |
| JWT signing secret, at least 32 characters | `Jwt__SecretKey` |
| WeatherAPI key | `WeatherApi__ApiKey` |

For local development, the values can instead be stored with .NET user secrets:

```powershell
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "<local-postgresql-connection>" --project backend/IFSWeather.Api
dotnet user-secrets set "Jwt:SecretKey" "<local-secret-at-least-32-characters>" --project backend/IFSWeather.Api
dotnet user-secrets set "WeatherApi:ApiKey" "<local-weatherapi-key>" --project backend/IFSWeather.Api
```

The frontend reads its API origin from `VITE_API_BASE_URL`. Copy the safe
example without adding secrets:

```powershell
Copy-Item frontend/.env.example frontend/.env
```

The development value is:

```text
VITE_API_BASE_URL=http://localhost:5112
```

`frontend/.env` and local backend settings are ignored by Git.

## Database

Apply the migrations already present in the repository:

```powershell
dotnet ef database update --project backend/IFSWeather.Infrastructure --startup-project backend/IFSWeather.Api
```

This command applies existing migrations; it does not create a new migration.

## Run locally

Start the backend:

```powershell
dotnet run --project backend/IFSWeather.Api --launch-profile http
```

The backend listens on `http://localhost:5112`. Its development CORS profile
allows both `http://localhost:5173` and `http://127.0.0.1:5173`.

In a second terminal, install dependencies and start the frontend:

```powershell
Set-Location frontend
npm install
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173`.

## Build and test

Backend:

```powershell
dotnet build backend/IFSWeather.slnx
dotnet test backend/IFSWeather.slnx --no-build
```

The PostgreSQL concurrency/bootstrap integration tests additionally require a
separate disposable test database configured through
`IFSWEATHER_TEST_ADMIN_CONNECTION_STRING`. Do not point this variable at a
shared, production, or demo database.

Frontend:

```powershell
Set-Location frontend
npm run build
npm test -- --run
npm run lint
```

Repository checks:

```powershell
git diff --check
git status --short
```

## Demo notes

- Authentication sessions are held in browser memory. A full browser refresh
  requires signing in again.
- User Today and weekly views read saved PostgreSQL records; they do not call
  WeatherAPI directly.
- The user's default city must match the canonical city name saved by the
  administrator.
- Today uses the backend UTC date. Prepare the demo record for that date.
- See [docs/FINAL_DEMO_RUNBOOK.md](docs/FINAL_DEMO_RUNBOOK.md) for the complete
  preflight and presentation flow.
