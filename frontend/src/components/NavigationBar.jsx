import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthProvider.jsx'

function NavigationBar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)

  const handleNavClick = (to) => {
    // Reset bookshelf restore state and scroll to top on explicit nav use (desktop & mobile)
    sessionStorage.setItem('bookshelfSkipRestore', '1')
    sessionStorage.removeItem('bookshelfAnchor')
    sessionStorage.removeItem('bookshelfScrollPos')
    window.scrollTo({ top: 0, behavior: 'auto' })
    if (to) navigate(to)
  }

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      
      // Show nav if scrolling up or at top, hide if scrolling down
      if (currentScrollY < lastScrollY || currentScrollY < 50) {
        setIsVisible(true)
      } else if (currentScrollY > lastScrollY) {
        setIsVisible(false)
      }
      
      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [lastScrollY])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <header className={`nav ${!isVisible ? 'nav-hidden' : ''}`}>
      <Link to="/" className="brand" onClick={() => handleNavClick('/')}> 
        <span className="brand-mark" aria-hidden>AB</span>
        <div>
          <div className="brand-title">A Bookshelf</div>
          <div className="brand-subtitle">Personal library HQ</div>
        </div>
      </Link>
      <nav className="nav-links" aria-label="Primary">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')} onClick={(e) => { e.preventDefault(); handleNavClick('/') }}>
          Dashboard
        </NavLink>
        <NavLink to="/bookshelf" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')} onClick={(e) => { e.preventDefault(); handleNavClick('/bookshelf') }}>
          Bookshelf
        </NavLink>
        <NavLink to="/add" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')} onClick={(e) => { e.preventDefault(); handleNavClick('/add') }}>
          Smart Add
        </NavLink>
      </nav>
      <div className="nav-actions">
        {user ? (
          <>
            <span className="nav-email">{user.email}</span>
            <button type="button" className="ghost" onClick={handleSignOut}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="ghost">
              Log in
            </Link>
            <Link to="/signup" className="primary">
              Create account
            </Link>
          </>
        )}
      </div>
    </header>
  )
}

export default NavigationBar
