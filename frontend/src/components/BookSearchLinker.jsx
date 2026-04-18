import { useState, useEffect, useRef } from 'react'
import { searchBooks } from '../lib/db.js'
import { useAuth } from '../context/AuthProvider.jsx'

function BookSearchLinker({ currentBookId, existingRelatedBooks = [], pendingRelatedBooks, onAddRelated, onRemoveRelated, onRemoveExistingRelated, isEditing = false }) {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [relationshipType, setRelationshipType] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(isEditing)
  const searchRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([])
      setShowResults(false)
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await searchBooks(user.id, query)
        // Filter out current book, already linked books, and pending books
        const linkedIds = new Set([
          currentBookId,
          ...existingRelatedBooks.map((r) => r.relatedBookId),
          ...pendingRelatedBooks.map((r) => r.relatedBookId),
        ])
        const filtered = data.filter((b) => !linkedIds.has(b.id))
        setResults(filtered)
        setShowResults(true)
      } catch (err) {
        console.error('Search failed:', err)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query, user.id, currentBookId, existingRelatedBooks, pendingRelatedBooks])

  const handleLink = (book) => {
    onAddRelated(book.id, relationshipType || 'related', book)
    setQuery('')
    setRelationshipType('')
    setResults([])
    setShowResults(false)
  }

  const _handleUnlinkRelated = (pendingId) => {
    if (!confirm('Remove this book link?')) return
    onRemoveRelated(pendingId)
  }

  if (!isEditing) {
    return null
  }

  return (
    <section className="card">
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`ghost collapsible-header ${!isCollapsed ? 'expanded' : ''}`}
      >
        <p className="eyebrow">Related Books</p>
        <span className="collapsible-arrow">{isCollapsed ? '▶' : '▼'}</span>
      </button>

      {!isCollapsed && (
        <>
          <p className="muted text-small mt-8">
            Link language versions or related books
          </p>

          {(existingRelatedBooks.length > 0 || pendingRelatedBooks.length > 0) && (
            <div className="linked-books">
              {existingRelatedBooks.map((rel) => (
                <div key={rel.id} className="linked-book-item">
                  <div className="linked-book-info">
                    {rel.book?.coverUrl && (
                      <img
                        src={rel.book.coverUrl}
                        alt={rel.book.title}
                      />
                    )}
                    <div>
                      <strong>{rel.book?.title || 'Unknown'}</strong>
                      <div className="language-relation">
                        {rel.book?.language && <span>{rel.book.language}</span>}
                        {rel.book?.language && rel.relationshipType && <span> • </span>}
                        {rel.relationshipType && <span>{rel.relationshipType}{rel.isReverse ? ' (links here)' : ''}</span>}
                      </div>
                    </div>
                    {onRemoveExistingRelated && !rel.isReverse && (
                      <button
                        type="button"
                        onClick={() => onRemoveExistingRelated(rel.id, rel.isReverse)}
                        className="btn-icon"
                        title="Remove"
                      >
                        ✕
                      </button>
                    )}
                    {onRemoveExistingRelated && rel.isReverse && (
                      <span className="muted text-tiny mr-auto pr-8">
                        (linked from other)
                      </span>
                    )}
                    {!onRemoveExistingRelated && (
                      <span className="muted text-tiny mr-auto pr-8">
                        (saved)
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {pendingRelatedBooks.map((rel) => (
                <div key={rel.tempId || rel.id} className="linked-book-item">
                  <div className="linked-book-info">
                    {rel.book?.coverUrl && (
                      <img
                        src={rel.book.coverUrl}
                        alt={rel.book.title}
                      />
                    )}
                    <div>
                      <strong>{rel.book?.title || 'Unknown'}</strong>
                      <div className="language-relation">
                        {rel.book?.language && <span>{rel.book.language}</span>}
                        {rel.book?.language && rel.relationshipType && <span> • </span>}
                        {rel.relationshipType && <span>{rel.relationshipType}</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveRelated(rel.tempId || rel.id)}
                      className="btn-icon"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div ref={searchRef} className="book-search-container">
            <div className="book-search-fields">
              <label className="field">
                <span>Search</span>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find a book..."
                  onFocus={() => {
                    if (results.length > 0) setShowResults(true)
                  }}
                />
              </label>
              <label className="field">
                <span>Relation</span>
                <input
                  type="text"
                  value={relationshipType}
                  onChange={(e) => setRelationshipType(e.target.value)}
                  placeholder="e.g. Spanish version"
                />
              </label>
            </div>

            {showResults && (
              <div className="search-results-dropdown">
                {loading && <div className="search-result-item">Searching...</div>}
                {!loading && results.length === 0 && <div className="search-result-item">No results found</div>}
                {!loading &&
                  results.map((book) => (
                    <button
                      key={book.id}
                      type="button"
                      className="search-result-item"
                      onClick={() => handleLink(book)}
                    >
                      <div className="flex items-center gap-12">
                        {book.coverUrl && (
                          <img
                            src={book.coverUrl}
                            alt={book.title}
                            className="search-result-image"
                          />
                        )}
                        <div className="flex-1 text-center">
                          <div className="search-result-title">{book.title}</div>
                          {book.language && <div className="search-result-subtitle">{book.language}</div>}
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}

export default BookSearchLinker