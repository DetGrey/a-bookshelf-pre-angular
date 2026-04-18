import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthProvider.jsx'
import AuthForm from '../components/AuthForm.jsx'
import { usePageTitle } from '../lib/usePageTitle.js'

function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  usePageTitle('Login')
  const redirectTo = location.state?.from?.pathname ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    const { error: signInError } = await signIn(email, password)
    setLoading(false)
    if (signInError) {
      setError(signInError.message)
      return
    }
    navigate(redirectTo)
  }

  const handleFieldChange = (field, value) => {
    if (field === 'email') setEmail(value)
    if (field === 'password') setPassword(value)
  }

  const fields = [
    {
      name: 'email',
      label: 'Email',
      type: 'email',
      value: email,
      autoComplete: 'email',
      required: true,
    },
    {
      name: 'password',
      label: 'Password',
      type: 'password',
      value: password,
      autoComplete: 'current-password',
      required: true,
    },
  ]

  return (
    <AuthForm
      title="Log in to continue"
      description="Access your library, notes, and saved sources."
      fields={fields}
      onFieldChange={handleFieldChange}
      onSubmit={handleSubmit}
      loading={loading}
      error={error}
      submitText="Log in"
    >
      <p className="muted">
        No account yet? <Link to="/signup">Create one</Link>
      </p>
    </AuthForm>
  )
}

export default Login
