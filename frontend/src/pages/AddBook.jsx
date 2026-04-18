import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthProvider.jsx'
import { createBook, addLink, addRelatedBook, getShelves, toggleBookShelf, STATUS_KEYS, STATUS } from '../lib/db.js'
import { usePageTitle } from '../lib/usePageTitle.js'
import { processCoverUrl } from '../lib/imageProxy.js'
import CoverImage from '../components/CoverImage.jsx'
import BookFormFields from '../components/BookFormFields.jsx'
import MetadataFetcher from '../components/MetadataFetcher.jsx'
import ShelfSelector from '../components/ShelfSelector.jsx'
import SourceManager from '../components/SourceManager.jsx'
import BookSearchLinker from '../components/BookSearchLinker.jsx'

function AddBook() {
  const { user } = useAuth()
  const navigate = useNavigate()
  usePageTitle('Add Book')
  const [url, setUrl] = useState('')
  const [metadata, setMetadata] = useState(null)
  const [fetchedAt, setFetchedAt] = useState(null)
  const [loading, setLoading] = useState(false)
  const [customShelves, setCustomShelves] = useState([])
  const [selectedShelves, setSelectedShelves] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [sources, setSources] = useState([])
  const [newSourceLabel, setNewSourceLabel] = useState('')
  const [newSourceUrl, setNewSourceUrl] = useState('')
  const [pendingRelatedBooks, setPendingRelatedBooks] = useState([])

  const [form, setForm] = useState({
    title: '',
    description: '',
    cover_url: '',
    genres: '',
      language: null,
    original_language: '',
    status: STATUS_KEYS[0],
    last_read: '',
    notes: '',
    latest_chapter: '',
    last_uploaded_at: '',
    times_read: 1,
    chapter_count: null,
    score: 0,
  })

  // Load custom shelves
  useEffect(() => {
    let mounted = true
    async function loadShelves() {
      if (!user) return
      try {
        const shelves = await getShelves(user.id)
        if (mounted) setCustomShelves(shelves)
      } catch (err) {
        console.error('Failed to load shelves:', err)
      }
    }
    loadShelves()
    return () => {
      mounted = false
    }
  }, [user])

  // Format ISO string to datetime-local (YYYY-MM-DDTHH:mm)
  // Preserve real time when present; only set to noon when the input is date-only
  const formatDatetimeLocal = (isoString) => {
    if (!isoString) return ''
    try {
      const hasExplicitTime = /T\d{2}:\d{2}/.test(isoString)

      // Date-only strings → set to 00:00
      if (!hasExplicitTime) {
        const dateMatch = isoString.match(/^(\d{4})-(\d{2})-(\d{2})/)
        if (dateMatch) {
          return `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T12:00`
        }
      }

      // Keep the time component when provided
      const date = new Date(isoString)
      if (Number.isNaN(date.getTime())) return ''
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day}T${hours}:${minutes}`
    } catch {
      return ''
    }
  }

  const getErrorMessage = (err) => {
    if (!err) return 'Unable to fetch metadata right now.'
    if (typeof err === 'string') return err
    if (err.message) return err.message
    if (err.error) return err.error
    if (err.description) return err.description
    if (err.context?.response?.statusText) return err.context.response.statusText
    return 'Unable to fetch metadata right now.'
  }

  // Fetch metadata from URL
  const handleFetch = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    setMetadata(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('fetch-metadata', {
        body: { url },
      })

      console.log('fetch-metadata response:', { data, error: fnError })

      if (fnError) throw new Error(getErrorMessage(fnError))
      if (data?.error) throw new Error(data.error)

      if (data?.metadata) {
        console.log('Extracted metadata:', data.metadata)
        const m = data.metadata
        setMetadata(m)
        setFetchedAt(new Date())

        setForm((prev) => ({
          ...prev,
          title: m.title || prev.title,
          description: m.description || prev.description,
          cover_url: m.image || prev.cover_url,
          genres: Array.isArray(m.genres) && m.genres.length > 0 ? m.genres.join(', ') : prev.genres,
          language: m.language ?? null,
          original_language: m.original_language ?? null,
          latest_chapter: m.latest_chapter || prev.latest_chapter,
          last_uploaded_at: formatDatetimeLocal(m.last_uploaded_at) || prev.last_uploaded_at,
          chapter_count: m.chapter_count ?? prev.chapter_count,
        }))
      }
      setSuccess('Metadata fetched. Review or edit fields below, then save.')
    } catch (err) {
      console.error('fetch-metadata error:', err)
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleAddSource = (e) => {
    e.preventDefault()
    if (newSourceLabel && newSourceUrl) {
      setSources([...sources, { id: `temp-${Date.now()}`, label: newSourceLabel, url: newSourceUrl }])
      setNewSourceLabel('')
      setNewSourceUrl('')
    }
  }

  const handleRemoveSource = (index) => {
    setSources(sources.filter((_, i) => i !== index))
  }

  const handleAddRelated = (relatedBookId, relationshipType = 'related', bookData = {}) => {
    const newRelated = {
      tempId: `temp-${Date.now()}-${Math.random()}`,
      relatedBookId,
      relationshipType,
      book: {
        title: bookData.title,
        language: bookData.language,
        coverUrl: bookData.coverUrl,
        id: bookData.id,
      },
      isNew: true,
    }
    setPendingRelatedBooks([...pendingRelatedBooks, newRelated])
  }

  const handleRemoveRelated = (tempId) => {
    setPendingRelatedBooks(pendingRelatedBooks.filter((r) => r.tempId !== tempId))
  }

  // Save book to library
  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const parsedScore = (() => {
        const n = Number(form.score)
        if (!Number.isFinite(n)) return 0
        if (n < 0 || n > 10) return 0
        return Math.round(n)
      })()

      // Process cover URL to upload to image proxy
      const processedCoverUrl = form.cover_url 
        ? await processCoverUrl(form.cover_url)
        : '';

      const payload = {
        title: form.title || 'Untitled',
        description: form.description || '',
        cover_url: processedCoverUrl,
        genres: form.genres
          ? form.genres.split(',').map((g) => g.trim()).filter(Boolean)
          : [],
         language: form.language || null,
        original_language: form.original_language || null,
        status: form.status,
        last_read: form.last_read || '',
        notes: form.notes || '',
        latest_chapter: form.latest_chapter || '',
        last_uploaded_at: form.last_uploaded_at || null,
        last_fetched_at: fetchedAt || null,
        times_read: form.times_read || 1,
        chapter_count: form.chapter_count ?? null,
        score: parsedScore,
      }

      const bookId = await createBook(user.id, payload)
      
      // Add all sources (including ones from fetched URL and manually added)
      if (url) await addLink(bookId, 'Source', url)
      for (const source of sources) {
        await addLink(bookId, source.label, source.url)
      }
      
      // Add related books
      for (const related of pendingRelatedBooks) {
        await addRelatedBook(bookId, related.relatedBookId, related.relationshipType)
      }

      // Add to selected shelves
      for (const shelfId of selectedShelves) {
        await toggleBookShelf(bookId, shelfId)
      }

      setSuccess('Saved to your library!')
      setTimeout(() => navigate('/bookshelf'), 800)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <p className="eyebrow">Smart Add</p>
          <h1>Paste a link, capture the details</h1>
          <p className="muted">
            Connects to the Supabase Edge Function `fetch-metadata` to pull Open Graph data from supported sites.
          </p>
        </div>
      </div>

      <form className="stack" onSubmit={handleFetch}>
        <label className="field">
          <span>Source URL</span>
          <p className="muted">
            Right now it only works with bato pages.
          </p>
          <div className="flex gap-8">
            <input
              className="flex-1"
              type="url"
              name="url"
              placeholder="https://example.com/volume-12"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              required
            />
            <button type="submit" className="primary" disabled={loading}>
              {loading ? 'Fetching…' : 'Fetch metadata'}
            </button>
          </div>
        </label>

        {error && <p className="error">{error}</p>}
        {metadata && (
          <p className="success">{success || 'Metadata fetched. Fields below were autofilled.'}</p>
        )}
      </form>

      <section className="card mt-16">
        <div className="stack">
          <p className="eyebrow">Book Details</p>
          <BookFormFields form={form} onChange={setForm} />

          <SourceManager
            sources={sources}
            onRemoveSource={handleRemoveSource}
            newSourceLabel={newSourceLabel}
            onSourceLabelChange={setNewSourceLabel}
            newSourceUrl={newSourceUrl}
            onSourceUrlChange={setNewSourceUrl}
            onAddSource={handleAddSource}
            isEditing={true}
          />

          <BookSearchLinker
            currentBookId={''}
            existingRelatedBooks={[]}
            pendingRelatedBooks={pendingRelatedBooks}
            onAddRelated={handleAddRelated}
            onRemoveRelated={handleRemoveRelated}
            isEditing={true}
          />

          <ShelfSelector
            customShelves={customShelves}
            selectedShelves={selectedShelves}
            onToggleShelf={(shelfId) => {
              setSelectedShelves(
                selectedShelves.includes(shelfId)
                  ? selectedShelves.filter((id) => id !== shelfId)
                  : [...selectedShelves, shelfId]
              )
            }}
          />

          <div className="flex gap-8">
            <button type="button" className="ghost" disabled={saving} onClick={handleSave}>
              {saving ? 'Saving…' : 'Save to Library'}
            </button>
          </div>
        </div>
      </section>

      {metadata && (
        <section className="card metadata">
          <CoverImage className="thumb" src={metadata.image} title={metadata.title} />
          <div className="stack">
            <p className="eyebrow">Preview</p>
            <h2>{metadata.title}</h2>
            <p className="muted">{metadata.description}</p>
            <div className="pill-row">
              <span className="pill">{STATUS[form.status]}</span>
              {form.last_read && <span className="pill ghost">Last: {form.last_read}</span>}
            </div>
            {form.genres && (
              <div className="pill-row mt-8">
                {form.genres.split(',').map((g, i) => (
                  <span key={`${g}-${i}`} className="pill ghost">{g.trim()}</span>
                ))}
              </div>
            )}
            <p className="muted">Ready to save to your library.</p>
          </div>
        </section>
      )}
    </div>
  )
}

export default AddBook
