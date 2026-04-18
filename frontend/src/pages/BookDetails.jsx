import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import { getBook, updateBook, addLink, deleteLink, deleteBook, getRelatedBooks, addRelatedBook, deleteRelatedBook, STATUS, scoreToLabel, SCORE_OPTIONS, getShelves, toggleBookShelf, getBookShelvesForBooks } from '../lib/db.js'
import { usePageTitle } from '../lib/usePageTitle.js'
import { useAuth } from '../context/AuthProvider.jsx'
import { processCoverUrl } from '../lib/imageProxy.js'
import CoverImage from '../components/CoverImage.jsx'
import BookFormFields from '../components/BookFormFields.jsx'
import MetadataFetcher from '../components/MetadataFetcher.jsx'
import SourceManager from '../components/SourceManager.jsx'
import ShelfSelector from '../components/ShelfSelector.jsx'
import BookSearchLinker from '../components/BookSearchLinker.jsx'
import { useBooks } from '../context/BooksProvider.jsx'

function BookDetails() {
  const { bookId } = useParams()
  const navigate = useNavigate()
  const { refetch } = useBooks()
  const { user } = useAuth()

  const [book, setBook] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    status: 'reading',
    language: null,
    original_language: '',
    score: 0,
    last_read: '',
    latest_chapter: '',
    notes: '',
    cover_url: '',
    genres: '', // comma-separated for editing
    last_uploaded_at: '',
    last_fetched_at: '',
    times_read: 1,
    chapter_count: null,
  })
  const [newSourceLabel, setNewSourceLabel] = useState('')
  const [newSourceUrl, setNewSourceUrl] = useState('')
  const [sources, setSources] = useState([])
  const [fetchUrl, setFetchUrl] = useState('')
  const [fetchLoading, setFetchLoading] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [fetchSuccess, setFetchSuccess] = useState('')
  const [fetchedMetadata, setFetchedMetadata] = useState(null)
  const [latestLoading, setLatestLoading] = useState(false)
  const [latestMessage, setLatestMessage] = useState('')
  const [latestStatus, setLatestStatus] = useState(null) // 'updated' | 'skipped' | 'error'
  const [latestDetails, setLatestDetails] = useState([])
  const [relatedBooks, setRelatedBooks] = useState([])
  const [pendingRelatedBooks, setPendingRelatedBooks] = useState([])
  const [deletedRelatedBookIds, setDeletedRelatedBookIds] = useState([])
  const [customShelves, setCustomShelves] = useState([])
  const [selectedShelves, setSelectedShelves] = useState([])
  const [currentShelves, setCurrentShelves] = useState([])

  usePageTitle(book?.title ? `${book.title}` : 'Book')

  // Always start at top on book details to avoid inheriting list scroll
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [bookId])

  const formatDatetimeLocal = (isoString) => {
    if (!isoString) return ''
    const d = new Date(isoString)
    if (Number.isNaN(d.getTime())) return ''
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const toIsoOrNull = (localValue) => {
    if (!localValue) return null
    const d = new Date(localValue)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const b = await getBook(bookId)
        if (!mounted) return
        setBook(b)
        setSources(b.sources ?? [])
        setEditForm({
          title: b.title ?? '',
          description: b.description ?? '',
          status: b.status ?? 'reading',
          language: b.language || null,
          original_language: b.original_language ?? '',
          score: b.score ?? 0,
          last_read: b.last_read ?? '',
          latest_chapter: b.latest_chapter ?? '',
          notes: b.notes ?? '',
          cover_url: b.cover_url ?? '',
          genres: (b.genres ?? []).join(', '),
          last_uploaded_at: formatDatetimeLocal(b.last_uploaded_at),
          last_fetched_at: formatDatetimeLocal(b.last_fetched_at),
          times_read: b.times_read ?? 1,
          chapter_count: b.chapter_count ?? null,
        })
        // Load related books
        const related = await getRelatedBooks(bookId)
        if (mounted) setRelatedBooks(related)
        
        // Load current shelves for this book
        const shelfMappings = await getBookShelvesForBooks([bookId])
        if (mounted) {
          const currentShelfIds = shelfMappings.map((sb) => sb.shelf_id)
          setCurrentShelves(currentShelfIds)
          setSelectedShelves(currentShelfIds)
        }
      } catch (err) {
        if (mounted) setError(err.message)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [bookId])

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

  if (loading) {
    return (
      <div className="page narrow">
        <div className="centered">
          <h2>Loading…</h2>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page narrow">
        <div className="centered">
          <h2>Could not load book</h2>
          <p className="error">{error}</p>
          <Link to="/" className="primary">Back to Dashboard</Link>
        </div>
      </div>
    )
  }

  if (!book) {
    return (
      <div className="page narrow">
        <div className="centered">
          <h2>Book not found</h2>
          <p className="muted">This book doesn't exist in your library.</p>
          <Link to="/" className="primary">Back to Dashboard</Link>
        </div>
      </div>
    )
  }

  const handleSave = async () => {
    const parsedScore = (() => {
      const n = Number(editForm.score)
      if (!Number.isFinite(n)) return 0
      if (n < 0 || n > 10) return 0
      return Math.round(n)
    })()

    const timesRead = (() => {
      const n = Number(editForm.times_read)
      if (!Number.isFinite(n) || n < 1) return 1
      return Math.round(n)
    })()

    // Process cover URL to upload to image proxy if needed
    const processedCoverUrl = editForm.cover_url
      ? await processCoverUrl(editForm.cover_url)
      : '';

    const payload = {
      ...editForm,
      cover_url: processedCoverUrl,
      genres: editForm.genres
        ? editForm.genres.split(',').map((g) => g.trim()).filter(Boolean)
        : [],
      score: parsedScore,
      language: editForm.language || null,
      last_uploaded_at: toIsoOrNull(editForm.last_uploaded_at),
      last_fetched_at: toIsoOrNull(editForm.last_fetched_at),
      times_read: timesRead,
      chapter_count: editForm.chapter_count ?? null,
    }
    await updateBook(book.id, payload)
    
    // Save new sources (that have temp IDs)
    for (const source of sources) {
      if (String(source.id).startsWith('temp-')) {
        await addLink(book.id, source.label, source.url)
      }
    }
    
    // Delete removed sources (that don't exist anymore)
    const currentSourceIds = new Set(sources.map((s) => s.id))
    for (const existingSource of (book.sources ?? [])) {
      if (!currentSourceIds.has(existingSource.id)) {
        await deleteLink(existingSource.id)
      }
    }
    
    // Save pending related books to database
    for (const related of pendingRelatedBooks) {
      if (related.isNew) {
        await addRelatedBook(book.id, related.relatedBookId, related.relationshipType)
      }
    }
    
    // Delete removed related books
    for (const relationshipId of deletedRelatedBookIds) {
      await deleteRelatedBook(relationshipId)
    }
    
    // Handle shelf changes
    for (const shelfId of selectedShelves) {
      if (!currentShelves.includes(shelfId)) {
        // Add shelf
        await toggleBookShelf(book.id, shelfId)
      }
    }
    for (const shelfId of currentShelves) {
      if (!selectedShelves.includes(shelfId)) {
        // Remove shelf
        await toggleBookShelf(book.id, shelfId)
      }
    }
    setCurrentShelves(selectedShelves)
    
    // Clear pending changes
    setPendingRelatedBooks([])
    setDeletedRelatedBookIds([])
    
    setBook({ ...book, ...payload, times_read: timesRead })
    setEditForm((prev) => ({ ...prev, times_read: timesRead }))
    refetch()
    setIsEditing(false)
  }

  const handleToggleShelf = (shelfId) => {
    setSelectedShelves((prev) =>
      prev.includes(shelfId) ? prev.filter((id) => id !== shelfId) : [...prev, shelfId]
    )
  }

  const handleDelete = async () => {
    if (confirm(`Delete "${book.title}" from your library?`)) {
      await deleteBook(book.id)
      navigate('/')
    }
  }

  const handleAddSource = async (e) => {
    e.preventDefault()
    if (newSourceLabel && newSourceUrl) {
      // Just add to local state, don't save to DB yet
      setSources([...sources, { id: `temp-${Date.now()}`, label: newSourceLabel, url: newSourceUrl }])
      setNewSourceLabel('')
      setNewSourceUrl('')
    }
  }

  const handleRemoveSource = (index) => {
    // Just remove from local state, deletion will be handled on save
    setSources(sources.filter((_, i) => i !== index))
  }

  const handleAddRelated = (relatedBookId, relationshipType = 'related', bookData = {}) => {
    // Add to pending related books (don't save to DB yet)
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
    // Remove from pending related books
    setPendingRelatedBooks(pendingRelatedBooks.filter((r) => r.tempId !== tempId))
  }

  const handleRemoveExistingRelated = (relationshipId, isReverse) => {
    // Reverse relations cannot be deleted from this side
    if (isReverse) {
      alert('This link was created from the other book. Remove it from there instead.')
      return
    }
    // Mark existing related book for deletion
    if (!confirm('Remove this book link?')) return
    setDeletedRelatedBookIds([...deletedRelatedBookIds, relationshipId])
    setRelatedBooks(relatedBooks.filter((r) => r.id !== relationshipId))
  }

  const handleFetch = async (e) => {
    e.preventDefault()
    setFetchError('')
    setFetchSuccess('')
    setFetchLoading(true)
    try {
      if (!fetchUrl) throw new Error('Please enter a URL to fetch.')
      const { data, error: fnError } = await supabase.functions.invoke('fetch-metadata', {
        body: { url: fetchUrl },
      })
      console.log('fetch-metadata response:', { data, error: fnError })
      if (fnError) throw fnError
      const fallback = {
        title: 'Metadata demo title',
        description: 'Connect your Supabase Edge Function to return real data.',
        image:
          'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=400&q=80',
        genres: [],
        original_language: '',
        latest_chapter: '',
        last_uploaded_at: null,
      }
      const meta = data?.metadata ?? fallback
      console.log('Extracted metadata:', meta)
      setFetchedMetadata(meta)
      setFetchSuccess('Metadata fetched. Review below, then apply to fields.')
    } catch (err) {
      console.error('fetch-metadata error:', err)
      setFetchError(err?.message ?? 'Unable to fetch metadata right now.')
    } finally {
      setFetchLoading(false)
    }
  }

  const applyFetched = () => {
    if (!fetchedMetadata) return
    const now = new Date().toISOString()
    setEditForm((prev) => ({
      ...prev,
      title: fetchedMetadata.title ?? prev.title,
      description: fetchedMetadata.description ?? prev.description,
      cover_url: fetchedMetadata.image ?? prev.cover_url,
      genres: (fetchedMetadata.genres ?? []).join(', '),
      language: fetchedMetadata.language ?? null,
      original_language: fetchedMetadata.original_language ?? null,
      latest_chapter: fetchedMetadata.latest_chapter ?? prev.latest_chapter,
      last_uploaded_at: fetchedMetadata.last_uploaded_at
        ? formatDatetimeLocal(fetchedMetadata.last_uploaded_at)
        : prev.last_uploaded_at,
      last_fetched_at: formatDatetimeLocal(now),
      chapter_count: fetchedMetadata.chapter_count ?? prev.chapter_count,
    }))
    setFetchSuccess('Applied metadata to fields. Remember to Save Changes.')
  }

  const handleFetchLatest = async () => {
    setLatestMessage('')
    setLatestStatus(null)
    setLatestDetails([])
    setLatestLoading(true)

    const url = sources?.[0]?.url
    if (!url) {
      setLatestMessage('No URL available for this book.')
      setLatestStatus('error')
      setLatestLoading(false)
      return
    }

    try {
      const prevLatest = (book.latest_chapter ?? '').trim()
      const prevUpload = book.last_uploaded_at
      const prevCount = normalizeCount(book.chapter_count)

      const { data: payload, error: fnError } = await supabase.functions.invoke('fetch-latest', {
        body: { url },
      })

      if (fnError || !payload) {
        throw new Error(fnError?.message || 'Failed to fetch latest')
      }

      const normalizeCount = (val) => {
        const n = Number(val)
        if (!Number.isFinite(n) || n <= 0) return null
        return Math.round(n)
      }

      const payloadLatest = payload.latest_chapter
      const payloadUploaded = payload.last_uploaded_at
      const payloadCount = normalizeCount(payload.chapter_count)

      const latestHasText = typeof payloadLatest === 'string' ? payloadLatest.trim() !== '' : Boolean(payloadLatest)
      const uploadHasValue = Boolean(payloadUploaded)
      const countHasValue = payloadCount !== null
      const emptyPayload = !latestHasText && !uploadHasValue && !countHasValue

      if (emptyPayload) {
        setLatestMessage('No chapter data found.')
        setLatestStatus('skipped')
        setLatestDetails([])
        setLatestLoading(false)
        return
      }

      const normalizedPayloadLatest = latestHasText ? String(payloadLatest).trim() : ''
      const normalizedCurrentLatest = (book.latest_chapter ?? '').trim()
      const hasLatestChange = latestHasText && normalizedPayloadLatest !== normalizedCurrentLatest

      const parsedPayloadUpload = uploadHasValue ? new Date(payloadUploaded) : null
      const parsedCurrentUpload = book.last_uploaded_at ? new Date(book.last_uploaded_at) : null
      const payloadUploadMs = parsedPayloadUpload && !isNaN(parsedPayloadUpload) ? parsedPayloadUpload.getTime() : null
      const currentUploadMs = parsedCurrentUpload && !isNaN(parsedCurrentUpload) ? parsedCurrentUpload.getTime() : null
      const payloadUploadDate = payloadUploadMs ? new Date(payloadUploadMs).toISOString().split('T')[0] : null
      const currentUploadDate = currentUploadMs ? new Date(currentUploadMs).toISOString().split('T')[0] : null
      const hasUploadChange = uploadHasValue && payloadUploadDate !== currentUploadDate

      const currentCount = normalizeCount(book.chapter_count)
      const hasCountChange = countHasValue && payloadCount !== currentCount

      const hasChange = hasLatestChange || hasUploadChange || hasCountChange

      if (!hasChange) {
        setLatestMessage('No changes found (already up to date).')
        setLatestStatus('skipped')
        setLatestDetails([])
        setLatestLoading(false)
        return
      }

      const now = new Date().toISOString()
      const { error: updateError } = await supabase
        .from('books')
        .update({
          latest_chapter: hasLatestChange ? payloadLatest : book.latest_chapter,
          last_uploaded_at: hasUploadChange ? payloadUploaded : book.last_uploaded_at,
          chapter_count: hasCountChange ? payloadCount : book.chapter_count,
          last_fetched_at: now,
        })
        .eq('id', book.id)

      if (updateError) throw updateError

      // Update local state
      setBook((prev) => ({
        ...prev,
        latest_chapter: hasLatestChange ? payloadLatest : prev.latest_chapter,
        last_uploaded_at: hasUploadChange ? payloadUploaded : prev.last_uploaded_at,
        chapter_count: hasCountChange ? payloadCount : prev.chapter_count,
        last_fetched_at: now,
      }))
      setEditForm((prev) => ({
        ...prev,
        latest_chapter: hasLatestChange ? payloadLatest : prev.latest_chapter,
        last_uploaded_at: hasUploadChange ? formatDatetimeLocal(payloadUploaded) : prev.last_uploaded_at,
        chapter_count: hasCountChange ? payloadCount : prev.chapter_count,
        last_fetched_at: formatDatetimeLocal(now),
      }))

      // Force context refresh so other views see the updated data immediately
      refetch()

      const details = []
      const fmtDate = (val) => {
        if (!val) return '—'
        const d = new Date(val)
        return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
      }
      if (hasLatestChange) details.push(`Latest chapter: ${prevLatest || '—'} → ${normalizedPayloadLatest || '—'}`)
      if (hasUploadChange) details.push(`Last upload: ${fmtDate(prevUpload)} → ${fmtDate(payloadUploaded)}`)
      if (hasCountChange) details.push(`Chapter count: ${prevCount ?? '—'} → ${payloadCount}`)

      setLatestMessage('Updated successfully.')
      setLatestStatus('updated')
      setLatestDetails(details)
    } catch (err) {
      setLatestMessage(err?.message || 'Failed to fetch latest chapter.')
      setLatestStatus('error')
      setLatestDetails([])
    } finally {
      setLatestLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <Link to="/bookshelf" className="ghost">← Back to Library</Link>
        {!isEditing && (
          <div className="flex gap-8">
            <button className="ghost" onClick={() => {
              setIsEditing(true)
              // Pre-fill fetchUrl with first source URL when entering edit mode
              if (sources.length > 0 && !fetchUrl) {
                setFetchUrl(sources[0].url)
              }
            }}>
              Edit
            </button>
            <button className="ghost delete-action-button" onClick={handleDelete}>
              Delete
            </button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="stack">
          <h1>Edit Book</h1>
          <MetadataFetcher
            fetchUrl={fetchUrl}
            onFetchUrlChange={setFetchUrl}
            onFetch={handleFetch}
            loading={fetchLoading}
            error={fetchError}
            success={fetchSuccess}
            fetchedMetadata={fetchedMetadata}
            onApply={applyFetched}
            compact={true}
          />

          <BookFormFields form={editForm} onChange={setEditForm} />

          <ShelfSelector
            customShelves={customShelves}
            selectedShelves={selectedShelves}
            onToggleShelf={handleToggleShelf}
          />

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
            currentBookId={book.id}
            existingRelatedBooks={relatedBooks}
            pendingRelatedBooks={pendingRelatedBooks}
            onAddRelated={handleAddRelated}
            onRemoveRelated={handleRemoveRelated}
            onRemoveExistingRelated={handleRemoveExistingRelated}
            isEditing={true}
          />

          <div className="flex gap-8 mt-12">
            <button className="primary" onClick={handleSave}>
              Save Changes
            </button>
            <button className="ghost" onClick={() => setIsEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="stack">
            <div className="book-hero">
            <CoverImage className="cover" src={book.cover_url} title={book.title} />
            <div className="stack">
              <div>
                <p className="eyebrow">{STATUS[book.status] ?? book.status}</p>
                <h1>{book.title}</h1>
                <p className="muted">{book.description}</p>
              </div>

              <div className="pill-row">
                {book.last_read && <span className="pill">Last read: {book.last_read}</span>}
                {book.latest_chapter && <span className="pill ghost">Latest: {book.latest_chapter}</span>}
              </div>

              <div className="stat-grid">
                <div className="stat">
                  <p className="muted">Status</p>
                  <strong>{STATUS[book.status] ?? book.status}</strong>
                </div>
                <div className="stat">
                  <p className="muted">Score</p>
                  <strong>{book.score === 0 ? '0 — N/A' : (scoreToLabel(book.score) || '—')}</strong>
                </div>
                <div className="stat">
                  <p className="muted">Language</p>
                  <strong>{book.language || '—'}</strong>
                </div>
                <div className="stat">
                  <p className="muted">Original Language</p>
                  <strong>{book.original_language || '—'}</strong>
                </div>
                <div className="stat">
                  <p className="muted">Last Updated</p>
                  <strong>{book.updated_at ? new Date(book.updated_at).toLocaleDateString() : '—'}</strong>
                </div>
                <div className="stat">
                  <p className="muted">Fetched</p>
                  <strong>{book.last_fetched_at ? new Date(book.last_fetched_at).toLocaleString() : '—'}</strong>
                </div>
                <div className="stat">
                  <p className="muted">Last Upload</p>
                  <strong>{book.last_uploaded_at ? new Date(book.last_uploaded_at).toLocaleString() : '—'}</strong>
                </div>
                <div className="stat">
                  <p className="muted">Times Read</p>
                  <strong>{book.times_read ?? 1}</strong>
                </div>
                <div className="stat">
                  <p className="muted">Chapter Count</p>
                  <strong>{book.chapter_count ?? '—'}</strong>
                </div>
              </div>

              <div className="related-section-wrapper">
                <button
                  className="primary related-link-preview"
                  onClick={handleFetchLatest}
                  disabled={latestLoading}
                >
                  {latestLoading ? 'Fetching…' : 'Fetch Latest Chapter'}
                </button>
                {latestMessage && (
                  <p
                    className={`${latestStatus === 'error' ? 'error' : latestStatus === 'updated' ? 'success' : 'muted'} related-link-title`}
                  >
                    {latestStatus === 'error'}{latestStatus === 'updated'}{latestStatus === 'skipped'}
                    {latestMessage}
                  </p>
                )}
                {latestDetails.length > 0 && (
                  <ul className="muted related-link-urls">
                    {latestDetails.map((d, idx) => (
                      <li key={idx}>{d}</li>
                    ))}
                  </ul>
                )}
              </div>

              {book.genres?.length > 0 && (
                <div className="pill-row genres-section">
                  {book.genres.map((g, i) => (
                    <button
                      key={`${g}-${i}`}
                      className="pill ghost genre-remove-button"
                      onClick={() => navigate(`/bookshelf?genre=${encodeURIComponent(g)}`)}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {book.notes && (
            <section className="card">
              <p className="eyebrow">Personal Notes</p>
              <p className="notes-section">{book.notes}</p>
            </section>
          )}

          <SourceManager
            sources={sources}
            onRemoveSource={handleRemoveSource}
            isEditing={false}
          />

          {currentShelves.length > 0 && (
            <section className="card">
              <p className="eyebrow">Shelves</p>
              <div className="pill-row">
                {currentShelves.map((shelfId) => {
                  const shelf = customShelves.find((s) => s.id === shelfId)
                  return shelf ? (
                    <button
                      key={shelfId}
                      className="pill ghost"
                      onClick={() => navigate(`/bookshelf?shelf=${encodeURIComponent(shelf.id)}`)}
                    >
                      {shelf.name}
                    </button>
                  ) : null
                })}
              </div>
            </section>
          )}

          {relatedBooks.length > 0 && (
            <section className="card">
              <p className="eyebrow">Related Books</p>
              <div className="related-books-grid">
                {relatedBooks.map((rel) => (
                  <Link
                    key={rel.id}
                    to={`/book/${rel.relatedBookId}`}
                    className="related-book-link"
                  >
                    {rel.book?.coverUrl && (
                      <img
                        src={rel.book.coverUrl}
                        alt={rel.book.title}
                      />
                    )}
                    <div className="related-book-info">
                      <strong>{rel.book?.title || 'Unknown'}</strong>
                      <small>
                        {rel.book?.language && <span>{rel.book.language}</span>}
                        {rel.book?.language && rel.relationshipType && <span> • </span>}
                        {rel.relationshipType && <span>{rel.relationshipType}{rel.isReverse ? ' (links here)' : ''}</span>}
                      </small>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

export default BookDetails
