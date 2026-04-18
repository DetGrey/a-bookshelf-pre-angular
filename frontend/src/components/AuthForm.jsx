/**
 * AuthForm Component
 * 
 * Reusable authentication form for Login and Signup pages
 * Handles email/password inputs and submission
 */
function AuthForm({
  title,
  description,
  fields,
  onFieldChange,
  onSubmit,
  loading,
  error,
  submitText,
  children,
}) {
  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit()
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <p className="eyebrow">Welcome</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>

        <form className="stack" onSubmit={handleSubmit}>
          {fields.map((field) => (
            <label key={field.name} className="field">
              <span>{field.label}</span>
              <input
                type={field.type}
                name={field.name}
                autoComplete={field.autoComplete}
                value={field.value}
                onChange={(e) => onFieldChange(field.name, e.target.value)}
                required={field.required !== false}
              />
            </label>
          ))}
          <button type="submit" className="primary" disabled={loading}>
            {loading ? `${submitText}...` : submitText}
          </button>
          {error && <p className="error">{error}</p>}
        </form>

        {children}
      </div>
    </div>
  )
}

export default AuthForm
