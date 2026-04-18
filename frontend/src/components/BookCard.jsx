import { useState } from 'react'
import { Link } from 'react-router-dom'
import { STATUS, truncateText, scoreToLabel } from '../lib/db.js'
import CoverImage from './CoverImage.jsx'

/**
 * BookCard Component
 * 
 * Displays a single book with:
 * - Cover image, title, description
 * - Status and metadata pills
 * - Latest chapter info
 * - Links to sources and book details
 * - Optional shelf management (for Bookshelf view)
 * 
 * @param {Object} props
 * @param {Object} props.book - Book data
 * @param {Function} props.onAddToShelf - Optional callback when shelf is toggled
 * @param {Array} props.customShelves - Optional list of custom shelves
 * @param {Array} props.activeGenres - Optional list of active genre filters
 * @param {Function} props.setActiveGenres - Optional callback to update genre filters
 * @param {boolean} props.compact - If true, shows simpler version (Dashboard mode)
 */
function BookCard({
  book,
  onAddToShelf,
  customShelves = [],
  activeGenres = [],
  setActiveGenres,
  compact = false,
  onOpenBook,
}) {
  const [showShelfMenu, setShowShelfMenu] = useState(false)

  const scoreColor = (score) => {
    const n = Number(score)
    if (!Number.isFinite(n)) return 'var(--text)'
    if (n >= 9) return '#b34ad3ff'   // great/masterpiece
    if (n >= 7) return '#0ba360'   // good/pretty good
    if (n >= 5) return '#c6a700'   // average/fine
    if (n >= 3) return '#d97706'   // bad/pretty bad
    if (n >= 1) return '#d14343'   // appalling/horrible
    return '#ffffff'               // 0 / N/A
  }

  const languageFlag = (lang) => {
    if (!lang) return null
    const lower = lang.toLowerCase()
    if (lower.startsWith('eng') || lower === 'en' || lower === 'english') return '🇬🇧'
    if (lower.startsWith('jap') || lower === 'jp' || lower === 'ja' || lower === 'jpn') return '🇯🇵'
    if (lower.startsWith('kor') || lower === 'kr' || lower === 'ko') return '🇰🇷'
    if (lower.startsWith('chi') || lower.includes('mandarin') || lower === 'cn' || lower === 'zh') return '🇨🇳'
    if (lower.startsWith('spa') || lower === 'es') return '🇪🇸'
    return null
  }

  const handleToggleShelf = (shelfId) => {
    if (onAddToShelf) {
      onAddToShelf(book.id, shelfId)
      setShowShelfMenu(false)
    }
  }

  return (
    <article className="card" style={{ zIndex: showShelfMenu ? 50 : 0 }} data-book-id={book.id}>
      <div className="card-head">
        <Link to={`/book/${book.id}`} className="cover-link" onClick={() => onOpenBook?.(book.id)}>
          <CoverImage
            className="thumb cursor-pointer"
            src={book.cover_url}
            title={book.title}
            alt={book.title}
          />
        </Link>
        <div className={!compact ? 'title-container' : ''}>
          <h3 className="title-text">{book.title}</h3>
          <p className="muted text-break">
            {truncateText(book.description)}
          </p>
          <div className="pill-row">
            <span className="pill">{STATUS[book.status] ?? book.status}</span>
            {book.score !== undefined && book.score !== null && book.score !== 0 ? (
              <span
                className="pill ghost"
                style={{ color: scoreColor(book.score), borderColor: scoreColor(book.score) }}
              >
                {scoreToLabel(book.score) || `Score: ${book.score}`}
              </span>
            ) : null}
            {!compact && book.language && (
              <span className="pill ghost emoji-text language-pill" title="Reading Language">
                {languageFlag(book.language) ? `${languageFlag(book.language)} ` : ''}
                {book.language}
              </span>
            )}
            {book.original_language && (
              <span className="pill ghost emoji-text original-language-pill" title="Original Language">
                {languageFlag(book.original_language) ? `${languageFlag(book.original_language)} ` : ''}
                {book.original_language}
              </span>
            )}
            {book.times_read !== undefined && book.times_read !== null && book.times_read > 1 && (
              <span className="pill ghost">Reads: {book.times_read}</span>
            )}
            {book.chapter_count !== undefined && book.chapter_count !== null && (
              <span className="pill ghost">Chapters: {book.chapter_count}</span>
            )}
            {!compact &&
              book.shelves?.map((shelfId) => {
                const shelf = customShelves.find((s) => s.id === shelfId)
                return shelf ? (
                  <span key={shelfId} className="pill shelf-indicator">
                    📚 {shelf.name}
                  </span>
                ) : null
              })}
          </div>
          {!compact && book.notes && (
            <p className="muted notes-text">
              📝 {book.notes}
            </p>
          )}
          {!compact && book.genres?.length > 0 && (
            <div className="pill-row genre-pills">
              {book.genres.map((g, i) => {
                const isActive = activeGenres.includes(g)
                return (
                  <button
                    key={`${g}-${i}`}
                    className={isActive ? 'pill' : 'pill ghost pill-small'}
                    onClick={() => {
                      if (setActiveGenres) {
                        setActiveGenres(
                          isActive ? activeGenres.filter((genre) => genre !== g) : [...activeGenres, g]
                        )
                      }
                    }}
                  >
                    {g}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
      <div className="card-footer">
        <div>
          {book.last_read && book.status !== 'completed' && (
            <>
              <p className="muted">Last read</p>
              <p>{book.last_read}</p>
            </>
          )}
          <p className={`muted ${book.last_read && book.status !== 'completed' ? 'mt-8' : ''}`}>Latest chapter</p>
          <p>{book.latest_chapter || '—'}</p>
          {!compact && book.last_uploaded_at && (
            <p className="muted upload-date">
              {new Date(book.last_uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </div>
        <div className="card-links">
          {book.sources.slice(0, compact ? 2 : 1).map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="ghost"
            >
              {source.label}
            </a>
          ))}
          {!compact && customShelves.length > 0 && (
            <div className="shelf-menu-container">
                <div className="shelf-button-wrapper">
              <button
                className="ghost shelf-button"
                onClick={() => setShowShelfMenu(!showShelfMenu)}
              >
                + Shelf
              </button>
                </div>
              {showShelfMenu && (
                <div className="shelf-dropdown">
                  {customShelves.map((shelf) => {
                    const isInShelf = book.shelves?.includes(shelf.id)
                    return (
                      <button
                        key={shelf.id}
                        className="shelf-dropdown-item"
                        onClick={() => handleToggleShelf(shelf.id)}
                      >
                        <span>{isInShelf ? '✓' : '○'}</span>
                        <span>{shelf.name}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          <Link to={`/book/${book.id}`} className="primary" onClick={() => onOpenBook?.(book.id)}>
            Details
          </Link>
        </div>
      </div>
    </article>
  )
}

export default BookCard
