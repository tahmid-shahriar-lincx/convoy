import React from 'react'
import { Link, useLocation } from 'react-router-dom'

const Layout = ({ children }) => {
  const location = useLocation()

  const isActive = (path) => {
    return location.pathname === path ? 'nav-link active' : 'nav-link'
  }

  return (
    <>
      <nav className='nav'>
        <div className='nav-container'>
          <Link to='/' className='nav-brand'>
            🚚 Convoy
          </Link>
          <div className='nav-links'>
            <Link to='/' className={isActive('/')}>
              Dashboard
            </Link>
            <Link to='/tokens' className={isActive('/tokens')}>
              Tokens
            </Link>
            <Link to='/conversations' className={isActive('/conversations')}>
              Conversations
            </Link>
            <Link to='/tasks' className={isActive('/tasks')}>
              Tasks
            </Link>
            <Link to='/manage-tasks' className={isActive('/manage-tasks')}>
              Manage Tasks
            </Link>
          </div>
        </div>
      </nav>
      <main className='main'>
        {children}
      </main>
    </>
  )
}

export default Layout
