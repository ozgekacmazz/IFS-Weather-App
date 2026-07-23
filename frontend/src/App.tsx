import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppShellPage } from './pages/AppShellPage'
import { LoginPage } from './pages/LoginPage'

interface AppProps {
  apiBaseUrl: string
}

export function App({ apiBaseUrl }: AppProps) {
  return (
    <AuthProvider apiBaseUrl={apiBaseUrl}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<AppShellPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </AuthProvider>
  )
}
