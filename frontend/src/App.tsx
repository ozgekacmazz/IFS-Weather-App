import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { UserRoles } from './auth/authTypes'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { RoleLandingPage } from './pages/RoleLandingPage'
import { UserProfilePage } from './pages/UserProfilePage'
import { UserWeatherDashboardPage } from './pages/UserWeatherDashboardPage'

interface AppProps {
  apiBaseUrl: string
}

export function App({ apiBaseUrl }: AppProps) {
  return (
    <AuthProvider apiBaseUrl={apiBaseUrl}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<ProtectedRoute />}>
          <Route
            element={<ProtectedRoute allowedRole={UserRoles.User} />}
          >
            <Route
              path="/app/weather"
              element={<UserWeatherDashboardPage />}
            />
            <Route path="/app/profile" element={<UserProfilePage />} />
          </Route>
          <Route
            element={<ProtectedRoute allowedRole={UserRoles.Admin} />}
          >
            <Route
              path="/app/admin"
              element={
                <RoleLandingPage
                  eyebrow="Administration"
                  title="Your administration workspace is ready."
                />
              }
            />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}
