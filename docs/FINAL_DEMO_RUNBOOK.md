# Final Demo Runbook

This runbook prepares a repeatable IFS Weather demonstration without storing
credentials or secrets in the repository. Supply all real values locally
through process environment variables or .NET user secrets.

## Preflight checklist

Complete these checks before the presentation:

- [ ] Active branch and working tree are the intended demo version.
- [ ] PostgreSQL is running and the configured demo database is reachable.
- [ ] Existing repository migrations have been applied.
- [ ] `ConnectionStrings__DefaultConnection` is available locally.
- [ ] `Jwt__SecretKey` is available locally and contains at least 32 characters.
- [ ] `WeatherApi__ApiKey` is available locally.
- [ ] `frontend/.env` contains
      `VITE_API_BASE_URL=http://localhost:5112`.
- [ ] The backend starts on `http://localhost:5112`.
- [ ] The frontend starts on `http://127.0.0.1:5173`.
- [ ] The browser can reach both applications without CORS or certificate
      errors.
- [ ] A known active administrator account can sign in.
- [ ] A known active user account can sign in.
- [ ] No account needed for the demo is locked or passive.
- [ ] The user default city matches the canonical city that the admin will save.
- [ ] The date shown by the backend in UTC is the intended Today date.
- [ ] Optional weekly records exist for the same city during the current
      Monday-to-Sunday UTC week.

Never paste real passwords, JWT secrets, connection strings, or WeatherAPI keys
into this file, screenshots, source files, terminal history shared with others,
or Git.

## Automated preflight

Run builds before starting the backend so a running API process does not lock
its output assemblies.

```powershell
dotnet build backend/IFSWeather.slnx
dotnet test backend/IFSWeather.slnx --no-build

Set-Location frontend
npm run build
npm test -- --run
npm run lint
Set-Location ..

git diff --check
git status --short
```

PostgreSQL integration tests require the separate
`IFSWEATHER_TEST_ADMIN_CONNECTION_STRING`. If it is intentionally unavailable,
record that limitation rather than substituting the demo database.

## Start the demo

Terminal 1:

```powershell
dotnet run --project backend/IFSWeather.Api --launch-profile http
```

Terminal 2:

```powershell
Set-Location frontend
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173`. Avoid a full browser refresh during the
presentation because the authentication session is intentionally held in
memory.

## Admin flow

1. Sign in with the locally supplied administrator account.
2. Open **Weather** from the admin navigation.
3. Search for a structured global location. Use a Unicode location if desired
   to demonstrate international search.
4. Select the location and click **Preview live weather**.
5. Explain that preview uses latitude/longitude and does not write to
   PostgreSQL.
6. Confirm the selected user-facing location label remains stable.
7. Click **Save preview to Today**.
8. Confirm the success message states whether the record was saved or updated.
9. Find the record in the weather table and open its details.
10. Click **Edit weather record**, change a safe visible value, and save.
11. Confirm the detail and list reflect the authoritative updated record.

For a richer weekly chart, use **Add weather record** before the demo to prepare
additional dates in the current UTC week. Use the same canonical city name.

## User flow

1. Sign out from the administrator account.
2. Optionally demonstrate registration with a new unique username and email.
3. Sign in with the prepared active user.
4. Set the user's **Default city** to the same canonical city saved by the
   administrator.
5. Confirm the Weather dashboard shows:
   - Today temperature with `°C`
   - weather condition and date
   - **Last updated**
   - weekly temperature trend and daily values
6. Click **Refresh weather** and explain that it reloads saved PostgreSQL data,
   not WeatherAPI.
7. Confirm the administrator's edited value appears on the user screen.
8. Optionally open **Live forecast** to contrast unsaved provider data with the
   saved Today workflow.
9. Sign out and sign back in to demonstrate authentication continuity across
   logout/login.

## Expected empty and error states

- No default city: the dashboard asks the user to choose one.
- No saved record for the backend UTC date: Today shows its intentional empty
  state.
- No records in the current UTC week: the weekly section shows its empty state.
- WeatherAPI unavailable: admin preview shows a safe provider error; existing
  saved user weather remains database-backed.
- Backend unreachable: login/register show an API configuration/reachability
  message.

## Recovery notes

- If frontend requests target the wrong origin, verify
  `frontend/.env`, stop Vite, and restart it.
- If backend build files are locked, stop the running `IFSWeather.Api` process,
  build, and then restart the API.
- If Today is empty after a save, verify the user's canonical default city and
  the backend UTC date.
- If the weekly chart is sparse, verify records fall within the current UTC
  Monday-to-Sunday range.
- If live preview fails, verify the local WeatherAPI key and provider
  availability without printing the key.
- If the browser is refreshed and returns to sign-in, sign in again; this is the
  expected in-memory session behavior.
