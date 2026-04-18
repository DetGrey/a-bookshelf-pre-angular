import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import NavigationBar from './components/NavigationBar.jsx'
import './App.css'

function App() {
  const location = useLocation()
  const hideNav = location.pathname === '/login' || location.pathname === '/signup'

  // Handle missing trailing slash on reload
  useEffect(() => {
    const currentUrl = window.location.pathname
    if (currentUrl === '/a-bookshelf' && !currentUrl.endsWith('/')) {
      window.location.replace('/a-bookshelf/')
    }
  }, [])

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
