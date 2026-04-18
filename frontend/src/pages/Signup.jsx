import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthProvider.jsx'
import AuthForm from '../components/AuthForm.jsx'
import { usePageTitle } from '../lib/usePageTitle.js'

function Signup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  usePageTitle('Sign up')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    setMessage('')

    // Validate passwords match
    if (password !== passwordConfirm) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    const { error: signUpError } = await signUp(email, password)
    setLoading(false)
    if (signUpError) {
      setError(signUpError.message)
      return
    }

    setMessage('Check your email to confirm your account, then log in.')
    setEmail('')
    setPassword('')
    setPasswordConfirm('')
    navigate('/login')
  }

  const handleFieldChange = (field, value) => {
    if (field === 'email') setEmail(value)
    if (field === 'password') setPassword(value)
    if (field === 'passwordConfirm') setPasswordConfirm(value)
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
      autoComplete: 'new-password',
      required: true,
    },
    {
      name: 'passwordConfirm',
      label: 'Confirm Password',
      type: 'password',
      value: passwordConfirm,
      autoComplete: 'new-password',
      required: true,
    },
  ]

  return (
    <div className="auth">
      <div className="auth-card">
        <p className="eyebrow">Create account</p>
        <h1>Start your shelf</h1>
        <p className="muted">Sign up with email and password. Supabase handles auth.</p>

        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
        >
          {fields.map((field) => (
            <label key={field.name} className="field">
              <span>{field.label}</span>
              <input
                type={field.type}
                name={field.name}
                autoComplete={field.autoComplete}
                value={field.value}
                onChange={(e) => handleFieldChange(field.name, e.target.value)}
                required
              />
            </label>
          ))}
          <button type="submit" className="primary" disabled={loading}>
            {loading ? 'Creating...' : 'Create account'}
          </button>
          {error && <p className="error">{error}</p>}
          {message && <p className="success">{message}</p>}
        </form>

        <p className="muted">
          Already registered? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  )
}

export default Signup
