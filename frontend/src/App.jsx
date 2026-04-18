import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import NavigationBar from './components/NavigationBar.jsx'
import './App.css'

function App() {
  const location = useLocation()
  const hideNav = location.pathname === '/login' || location.pathname === '/signup'
  const basePath = import.meta.env.BASE_URL
  const normalizedBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath

  // Handle missing trailing slash on reload
  useEffect(() => {
    const currentUrl = window.location.pathname
    if (currentUrl === normalizedBase && !currentUrl.endsWith('/')) {
      window.location.replace(basePath)
    }
  }, [basePath, normalizedBase])

  return (
    <div className="shell">
      {!hideNav && <NavigationBar />}
      <main>
        <Outlet />
      </main>
    </div>
  )
}

export default App
