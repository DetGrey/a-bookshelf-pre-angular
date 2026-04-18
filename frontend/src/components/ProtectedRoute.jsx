import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthProvider.jsx'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="centered">
        <div className="spinner" aria-label="Loading" />
        <p className="muted">Checking your session...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}

export default ProtectedRoute
