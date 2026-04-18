import { STATUS, STATUS_KEYS, SCORE_OPTIONS } from '../lib/db.js'

/**
 * BookFormFields Component
 * 
 * Reusable form fields for book editing/creation
 * Used by both AddBook and BookDetails pages
 */
function BookFormFields({ form, onChange }) {
  const handleChange = (field, value) => {
    onChange({ ...form, [field]: value })
  }

  const capitalizeFirst = (val) => (val ? val.charAt(0).toUpperCase() + val.slice(1) : val)

  return (
    <>
      <label className="field">
        <span>Title</span>
        <input
          type="text"
          value={form.title}
          autoCapitalize='sentences'
          onChange={(e) => handleChange('title', e.target.value)}
        />
      </label>

      <label className="field">
        <span>Description</span>
        <textarea
          rows="3"
          value={form.description}
          autoCapitalize='sentences'
          onChange={(e) => handleChange('description', e.target.value)}
        />
      </label>

      <div className="grid-2">
        <label className="field">
          <span>Status</span>
          <select
            value={form.status}
            onChange={(e) => handleChange('status', e.target.value)}
          >
            {STATUS_KEYS.map((key) => (
              <option key={key} value={key}>
                {STATUS[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Score</span>
          <select
            value={form.score ?? 0}
            onChange={(e) => handleChange('score', Number(e.target.value))}
          >
            {SCORE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid-2">
        <label className="field">
          <span>Times Read</span>
          <input
            type="number"
            min="1"
            value={form.times_read ?? 1}
            onChange={(e) => handleChange('times_read', e.target.value === '' ? '' : Number(e.target.value))}
            onBlur={(e) => {
              const val = Number(e.target.value)
              if (!Number.isFinite(val) || val < 1) {
                handleChange('times_read', 1)
              } else {
                handleChange('times_read', Math.round(val))
              }
            }}
          />
        </label>
        <label className="field">
          <span>Chapter Count</span>
          <input
            type="number"
            min="0"
            placeholder="Auto-filled when available"
            value={form.chapter_count ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              handleChange('chapter_count', val === '' ? '' : Number(val))
            }}
            onBlur={(e) => {
              const val = e.target.value;
              if (val === '') {
                handleChange('chapter_count', null)
              } else {
                const n = Number(val)
                if (!Number.isFinite(n) || n < 0) {
                  handleChange('chapter_count', null)
                } else {
                  handleChange('chapter_count', Math.round(n))
                }
              }
            }}
          />
        </label>
      </div>

      <div className="grid-2">
        <label className="field">
          <span>Last Read</span>
          <input
            type="text"
            placeholder="Ch 50"
            value={form.last_read}
            autoCapitalize='sentences'
            onChange={(e) => handleChange('last_read', capitalizeFirst(e.target.value))}
          />
        </label>
        <label className="field">
          <span>Cover Image URL</span>
          <input
            type="url"
            placeholder="https://..."
            value={form.cover_url}
            onChange={(e) => handleChange('cover_url', e.target.value)}
          />
        </label>
        <label className="field">
          <span>Language</span>
          <input
            type="text"
            placeholder="English, Spanish..."
            value={form.language ?? ''}
            autoCapitalize='words'
            onChange={(e) => handleChange('language', e.target.value)}
          />
        </label>
        <label className="field">
          <span>Original Language</span>
          <input
            type="text"
            placeholder="Japanese, Korean, English..."
            value={form.original_language ?? ''}
            autoCapitalize='sentences'
            onChange={(e) => handleChange('original_language', e.target.value)}
          />
        </label>
      </div>

      <div className="grid-2">
        <label className="field">
          <span>Genres</span>
          <input
            type="text"
            placeholder="Action, Romance, Fantasy"
            value={form.genres}
            autoCapitalize='words'
            onChange={(e) => handleChange('genres', e.target.value)}
          />
        </label>
        <label className="field">
          <span>Latest Chapter (site)</span>
          <input
            type="text"
            value={form.latest_chapter}
            autoCapitalize='sentences'
            onChange={(e) => handleChange('latest_chapter', capitalizeFirst(e.target.value))}
          />
        </label>
      </div>

      <label className="field">
        <span>Last Uploaded At (site)</span>
        <input
          type="datetime-local"
          value={form.last_uploaded_at || ''}
          onChange={(e) => handleChange('last_uploaded_at', e.target.value)}
        />
      </label>

      {form.last_fetched_at !== undefined && (
        <label className="field">
          <span>Last Fetched At</span>
          <input
            type="datetime-local"
            value={form.last_fetched_at || ''}
            onChange={(e) => handleChange('last_fetched_at', e.target.value)}
          />
        </label>
      )}

      <label className="field">
        <span>Notes</span>
        <textarea
          rows="3"
          placeholder="Personal notes, reading progress, etc."
          value={form.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
        />
      </label>
    </>
  )
}

export default BookFormFields
