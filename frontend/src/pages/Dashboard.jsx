import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthProvider.jsx'
import { useBooks } from '../context/BooksProvider.jsx'
import { getBackup, restoreBackup, STATUS } from '../lib/db.js'
import { usePageTitle } from '../lib/usePageTitle.js'
import BookCard from '../components/BookCard.jsx'
import QualityChecks from '../components/QualityChecks.jsx'
import GenreConsolidator from '../components/GenreConsolidator.jsx'

function Dashboard() {
  const { user } = useAuth()
  const { books, loading } = useBooks()
  const [backupLoading, setBackupLoading] = useState(false)
  const [backupError, setBackupError] = useState('')
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [restoreMessage, setRestoreMessage] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  // Load cached results on mount so user sees previous findings without re-clicking
  useEffect(() => {
    const dupeCached = sessionStorage.getItem('dupeCache')
    const staleCached = sessionStorage.getItem('staleCache')
    // Cache is now handled by individual components
  }, [])
  const [genreMoreExpanded, setGenreMoreExpanded] = useState(false)
  const [sourceMoreExpanded, setSourceMoreExpanded] = useState(false)
  const [booksPerStatus, setBooksPerStatus] = useState(6)
  const fileInputRef = useRef(null)

  usePageTitle('Dashboard')

  // Update books per status based on screen size
  useEffect(() => {
    const updateBooksPerStatus = () => {
      setBooksPerStatus(window.innerWidth < 768 ? 3 : 4)
    }
    updateBooksPerStatus()
    window.addEventListener('resize', updateBooksPerStatus)
    return () => window.removeEventListener('resize', updateBooksPerStatus)
  }, [])

  const loadBooks = useCallback(async () => {
    if (!user) return
    // Books are now managed by BooksProvider context
  }, [user])

  useEffect(() => {
    loadBooks()
  }, [user, loadBooks])

  const sectionKeys = ['reading', 'plan_to_read', 'waiting', 'completed']
  const lastUpdated = books[0]?.updated_at

  const waitingCount = books.filter((b) => b.status === 'waiting').length

  const handleDownloadBackup = async () => {
    if (!user || backupLoading) return
    setBackupLoading(true)
    setBackupError('')
    try {
      const data = await getBackup(user.id)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const date = new Date().toISOString().split('T')[0]
      a.href = url
      a.download = `a-bookshelf-backup-${date}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : String(err))
    } finally {
      setBackupLoading(false)
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleRestore = async (event) => {
    const file = event.target.files?.[0]
    if (!file || !user) return
    setRestoreMessage('')
    setBackupError('')
    setRestoreLoading(true)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      await restoreBackup(user.id, json)
      setRestoreMessage('Restore complete. Refreshing data…')
      // Context will automatically refresh via realtime subscription
      setRestoreMessage('Restore complete.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Restore failed'
      setBackupError(message)
    } finally {
      setRestoreLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Stats: average score (ignore 0) and perfect scores
  const scoredBooks = books.filter((b) => {
    const n = Number(b.score)
    return Number.isFinite(n) && n !== 0
  })
  const averageScore = scoredBooks.length
    ? (scoredBooks.reduce((sum, b) => sum + Number(b.score), 0) / scoredBooks.length).toFixed(1)
    : null
  const perfectScoreCount = books.filter((b) => Number(b.score) === 10).length

  // Genre breakdown - count books that have each genre (not total genre occurrences)
  const IGNORE_GENRES = new Set(['manhwa', 'manhua', 'webtoon', 'manga', 'full color'])
  const booksWithGenre = new Map() // Map of genre -> Set of book IDs
  books.forEach((book) => {
    (book.genres ?? []).forEach((g) => {
      const key = g.trim()
      if (!key) return
      if (IGNORE_GENRES.has(key.toLowerCase())) return
      if (!booksWithGenre.has(key)) {
        booksWithGenre.set(key, new Set())
      }
      booksWithGenre.get(key).add(book.id)
    })
  })
  // Convert to counts and sort
  const genreCountMap = new Map(
    Array.from(booksWithGenre.entries()).map(([genre, bookSet]) => [genre, bookSet.size])
  )
  const genreEntriesRaw = Array.from(genreCountMap.entries()).sort((a, b) => b[1] - a[1])
  const totalBooks = books.length
  const palette = ['#7c83ff', '#ff8ba7', '#22c55e', '#f6aa1c', '#4cc9f0', '#a855f7', '#ef4444', '#0ea5e9']

  // URL/sources breakdown - count all sources per host (including duplicates)
  const hostCountMap = new Map()
  books.forEach((book) => {
    (book.sources ?? []).forEach((source) => {
      try {
        const url = new URL(source.url)
        let host = url.hostname
        // Remove www. prefix if present
        if (host.startsWith('www.')) {
          host = host.slice(4)
        }
        hostCountMap.set(host, (hostCountMap.get(host) ?? 0) + 1)
      } catch {
        // Skip invalid URLs
      }
    })
  })
  const hostEntriesRaw = Array.from(hostCountMap.entries()).sort((a, b) => b[1] - a[1])

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>Your library at a glance</h1>
          <p className="muted">Track reading, pull metadata, and jump back into the next chapter fast.</p>
        </div>
          <Link to="/add" className="primary">Smart Add</Link>
      </div>

      {backupError && <p className="error">{backupError}</p>}
      {restoreMessage && <p className="muted">{restoreMessage}</p>}

      <section className="stat-grid">
        <div className="stat">
          <p className="muted">Total saved</p>
          <strong>{loading ? '—' : books.length}</strong>
        </div>
        <div className="stat">
          <p className="muted">Completed</p>
          <strong>{loading ? '—' : books.filter((b) => b.status === 'completed').length}</strong>
        </div>
        <div className="stat">
          <p className="muted">Waiting for updates</p>
          <strong>{loading ? '—' : waitingCount}</strong>
        </div>
        <div className="stat">
          <p className="muted">Last updated</p>
          <strong>{loading || !lastUpdated ? '—' : new Date(lastUpdated).toLocaleDateString()}</strong>
        </div>
        <div className="stat">
          <p className="muted">Average score</p>
          <strong>{loading ? '—' : averageScore ?? '—'}</strong>
        </div>
        <div className="stat">
          <p className="muted">Score 10 count</p>
          <strong>{loading ? '—' : perfectScoreCount}</strong>
        </div>
      </section>

      <section className="card dashboard-section">
        <div className="block-head dashboard-section-header">
          <h2>Genre breakdown</h2>
          <p className="muted">
            {totalBooks ? 'Books by genre (% of your library) — books can have multiple genres' : 'No genre data yet'}
          </p>
        </div>
        {totalBooks > 0 && genreEntriesRaw.length > 0 ? (
          <div className="genre-list-container">
            {/* Top 5 genres - always visible */}
            {genreEntriesRaw.slice(0, 5).map(([genre, count], idx) => {
              const percent = ((count / totalBooks) * 100).toFixed(1)
              const barWidth = Math.min((count / totalBooks) * 100, 100)
              return (
                <div key={genre} className="genre-bar-item">
                  <div className="genre-bar-header">
                    <span className="genre-bar-name">{genre}</span>
                    <span className="muted genre-bar-stats">{percent}% ({count})</span>
                  </div>
                  <div className="genre-bar-track">
                    <div
                      className="genre-bar-fill"
                      style={{
                        width: `${barWidth}%`,
                        background: palette[idx % palette.length],
                      }}
                    />
                  </div>
                </div>
              )
            })}
            
            {/* Remaining genres - collapsible */}
            {genreEntriesRaw.length > 5 && (
              <div>
                <button
                  type="button"
                  className="ghost genre-more-button"
                  onClick={() => setGenreMoreExpanded(!genreMoreExpanded)}
                >
                  <span>{genreMoreExpanded ? '▼' : '▶'}</span>
                  <span>+ {genreEntriesRaw.length - 5} more genres</span>
                </button>
                
                {genreMoreExpanded && (
                  <div className="mt-8">
                    {genreEntriesRaw.slice(5).map(([genre, count], idx) => {
                      const percent = ((count / totalBooks) * 100).toFixed(1)
                      const barWidth = Math.min((count / totalBooks) * 100, 100)
                      return (
                        <div key={genre} className="genre-bar-item">
                          <div className="genre-bar-header">
                            <span className="genre-bar-name">{genre}</span>
                            <span className="muted genre-bar-stats">{percent}% ({count})</span>
                          </div>
                          <div className="genre-bar-track">
                            <div
                              className="genre-bar-fill"
                              style={{
                                width: `${barWidth}%`,
                                background: palette[(5 + idx) % palette.length],
                              }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="muted">Add genres to your books to see the breakdown.</p>
        )}
      </section>

      <section className="card dashboard-section">
        <div className="block-head dashboard-section-header">
          <h2>Sources breakdown</h2>
          <p className="muted">
            {totalBooks ? 'Books by source (% of your library) — books can have multiple sources' : 'No source data yet'}
          </p>
        </div>
        {totalBooks > 0 && hostEntriesRaw.length > 0 ? (
          <div className="genre-list-container">
            {/* Top 5 sources - always visible */}
            {hostEntriesRaw.slice(0, 5).map(([host, count], idx) => {
              const percent = ((count / totalBooks) * 100).toFixed(1)
              const barWidth = Math.min((count / totalBooks) * 100, 100)
              return (
                <div key={host} className="genre-bar-item">
                  <div className="genre-bar-header">
                    <span className="genre-bar-name">{host}</span>
                    <span className="muted genre-bar-stats">{percent}% ({count})</span>
                  </div>
                  <div className="genre-bar-track">
                    <div
                      className="genre-bar-fill"
                      style={{
                        width: `${barWidth}%`,
                        background: palette[idx % palette.length],
                      }}
                    />
                  </div>
                </div>
              )
            })}
            
            {/* Remaining sources - collapsible */}
            {hostEntriesRaw.length > 5 && (
              <div>
                <button
                  type="button"
                  className="ghost genre-more-button"
                  onClick={() => setSourceMoreExpanded(!sourceMoreExpanded)}
                >
                  <span>{sourceMoreExpanded ? '▼' : '▶'}</span>
                  <span>+ {hostEntriesRaw.length - 5} more sources</span>
                </button>
                
                {sourceMoreExpanded && (
                  <div className="mt-8">
                    {hostEntriesRaw.slice(5).map(([host, count], idx) => {
                      const percent = ((count / totalBooks) * 100).toFixed(1)
                      const barWidth = Math.min((count / totalBooks) * 100, 100)
                      return (
                        <div key={host} className="genre-bar-item">
                          <div className="genre-bar-header">
                            <span className="genre-bar-name">{host}</span>
                            <span className="muted genre-bar-stats">{percent}% ({count})</span>
                          </div>
                          <div className="genre-bar-track">
                            <div
                              className="genre-bar-fill"
                              style={{
                                width: `${barWidth}%`,
                                background: palette[(5 + idx) % palette.length],
                              }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="muted">Add sources to your books to see the breakdown.</p>
        )}
      </section>

      {sectionKeys.map((key) => {
        const sectionBooks = books
          .filter((book) => book.status === key)
          .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
          .slice(0, booksPerStatus)
        if (!sectionBooks.length) return null
        return (
          <section key={key} className="block">
            <div className="block-head">
              <h2 className="section-heading">
                {key === 'reading' ? 'Currently reading' : STATUS[key]}
              </h2>
            </div>
            <div className="card-grid dashboard-status-grid">
              {sectionBooks.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  compact
                />
              ))}
            </div>
          </section>
        )
      })}

      <section className="card quality-check-section">
        <div className="block-head quality-check-header">
          <div>
            <p className="eyebrow m-0">Tools</p>
            <h2 className="m-0">Quality checks & tools</h2>
            <p className="muted m-0">Audit and improve your library</p>
          </div>
        </div>
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          <QualityChecks books={books} loading={loading} />
          <GenreConsolidator books={books} loading={loading} onRefresh={() => setRefreshKey(k => k + 1)} />
        </div>
      </section>

      <section className="card data-portability-section">
          <div>
            <p className="eyebrow m-0">Data portability</p>
            <p className="muted m-0">Download or upload all your data as JSON (books, shelves, links).</p>
          </div>
          <div className="data-portability-buttons">
            <button
              className="ghost quality-check-button"
              onClick={handleUploadClick}
              disabled={restoreLoading}
            >
              {restoreLoading ? 'Importing…' : 'Upload JSON'}
            </button>
            <button
              className="ghost quality-check-button"
              onClick={handleDownloadBackup}
              disabled={backupLoading}
            >
              {backupLoading ? 'Preparing…' : 'Download Backup'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden-file-input"
              onChange={handleRestore}
            />
          </div>
        </section>
    </div>
  )
}

export default Dashboard
