import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthProvider.jsx'
import { BooksProvider } from './context/BooksProvider.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Dashboard from './pages/Dashboard.jsx'
import AddBook from './pages/AddBook.jsx'
import BookDetails from './pages/BookDetails.jsx'
import Bookshelf from './pages/Bookshelf.jsx'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: (
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: 'bookshelf',
        element: (
          <ProtectedRoute>
            <Bookshelf />
          </ProtectedRoute>
        ),
      },
      {
        path: 'add',
        element: (
          <ProtectedRoute>
            <AddBook />
          </ProtectedRoute>
        ),
      },
      {
        path: 'book/:bookId',
        element: (
          <ProtectedRoute>
            <BookDetails />
          </ProtectedRoute>
        ),
      },
      {
        path: 'login',
        element: <Login />,
      },
      {
        path: 'signup',
        element: <Signup />,
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
], { basename: '/a-bookshelf' })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <BooksProvider>
        <RouterProvider router={router} />
      </BooksProvider>
    </AuthProvider>
  </StrictMode>,
)
