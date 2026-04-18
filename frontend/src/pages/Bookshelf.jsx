import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthProvider.jsx'
import { useBooks } from '../context/BooksProvider.jsx'
import { toggleBookShelf, createShelf, deleteShelf, getShelves, STATUS } from '../lib/db.js'
import { supabase } from '../lib/supabaseClient.js'
import { usePageTitle } from '../lib/usePageTitle.js'
import ShelfSidebar from '../components/ShelfSidebar.jsx'
import BookGrid from '../components/BookGrid.jsx'
import GenreFilter from '../components/GenreFilter.jsx'
import ChapterCountFilter from '../components/ChapterCountFilter.jsx'

// Built-in status-based shelves
const statusShelves = [
  { id: 'all', name: 'All Books', isStatus: true },
  { id: 'reading', name: STATUS.reading, isStatus: true },
  { id: 'plan_to_read', name: STATUS.plan_to_read, isStatus: true },
  { id: 'waiting', name: STATUS.waiting, isStatus: true },
  { id: 'completed', name: STATUS.completed, isStatus: true },
  { id: 'dropped', name: STATUS.dropped, isStatus: true },
  { id: 'on_hold', name: STATUS.on_hold, isStatus: true },
]

const sortOptions = [
  { value: 'relevance', label: 'Relevance (search)' },
  { value: 'created', label: 'Date Added' },
  { value: 'updated', label: 'Last Updated' },
  { value: 'score', label: 'Score' },
  { value: 'chapter_count', label: 'Chapter Count' },
  { value: 'title', label: 'Title (A-Z)' },
  { value: 'status', label: 'Status' },
]

function Bookshelf() {
  const { user } = useAuth()
  const { books, loading: contextLoading, setBooks } = useBooks()
  usePageTitle('Bookshelf')
  const [customShelves, setCustomShelves] = useState([])
  const [activeShelf, setActiveShelf] = useState('all')
  const [activeGenres, setActiveGenres] = useState([])
  const [genreFilterMode, setGenreFilterMode] = useState('all')
  const [genreFilterOpen, setGenreFilterOpen] = useState(false)
  const [chapterFilter, setChapterFilter] = useState({ mode: 'max', value: null })
  const [chapterFilterOpen, setChapterFilterOpen] = useState(false)
  const [languageFilter, setLanguageFilter] = useState('all')
  const [sortBy, setSortBy] = useState('created')
  const [sortDirection, setSortDirection] = useState('desc')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [checkingWaiting, setCheckingWaiting] = useState(false)
  const [updateMessage, setUpdateMessage] = useState('')
  const [errorDetails, setErrorDetails] = useState([])
  const [showErrors, setShowErrors] = useState(false)
  const [waitingProgress, setWaitingProgress] = useState({ current: 0, total: 0 })
  const [updateDetails, setUpdateDetails] = useState([])
  const [currentPage, setCurrentPage] = useState(() => {
    const stored = Number(sessionStorage.getItem('bookshelfPage'))
    return Number.isFinite(stored) && stored > 0 ? stored : 1
  })
  const [scrollRestored, setScrollRestored] = useState(false)
  const resultsRef = useRef(null)
  const lastFilterKeyRef = useRef('')
  const booksPerPage = 20

  const getNavOffset = () => (document.querySelector('header.nav')?.offsetHeight ?? 0) + 12

  const handleBookOpen = (bookId) => {
    sessionStorage.setItem('bookshelfAnchor', bookId)
    sessionStorage.setItem('bookshelfScrollPos', window.scrollY.toString())
    sessionStorage.setItem('bookshelfPage', currentPage.toString())
  }

  // Scroll to results header when current page changes, accounting for nav height
  useEffect(() => {
    if (!scrollRestored) return
    const target = resultsRef.current
    const offset = getNavOffset()
    if (target) {
      const top = target.getBoundingClientRect().top + window.scrollY
      window.scrollTo({ top: Math.max(top - offset, 0), behavior: 'smooth' })
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [currentPage, scrollRestored])

  // Persist scroll position while browsing
  useEffect(() => {
    const handleScroll = () => {
      sessionStorage.setItem('bookshelfScrollPos', window.scrollY.toString())
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Persist current page
  useEffect(() => {
    sessionStorage.setItem('bookshelfPage', currentPage.toString())
  }, [currentPage])

  // Clear update messages and reset pagination when shelf or filters change (skip initial load to preserve stored page)
  useEffect(() => {
    const key = [
      activeShelf,
      activeGenres.join(','),
      genreFilterMode,
      chapterFilter.mode,
      chapterFilter.value,
      languageFilter,
      searchQuery,
    ].join('|')

    if (lastFilterKeyRef.current && lastFilterKeyRef.current !== key) {
      setCurrentPage(1)
    }

    lastFilterKeyRef.current = key
    setUpdateMessage('')
    setErrorDetails([])
    setShowErrors(false)
  }, [activeShelf, activeGenres, genreFilterMode, chapterFilter, languageFilter, searchQuery])

  // When searching, prefer relevance sort; reset to date added when clearing search
  useEffect(() => {
    if (searchQuery && sortBy === 'created') {
      setSortBy('relevance')
    } else if (!searchQuery && sortBy === 'relevance') {
      setSortBy('created')
    }
    // we intentionally omit sortBy from deps to avoid fighting user choice when typing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery])

  // Read all filters from URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    
    // Read shelf/status
    const shelfParam = params.get('shelf')
    if (shelfParam) {
      setActiveShelf(decodeURIComponent(shelfParam))
    }
    
    // Read genre(s)
    const genreParam = params.get('genre')
    if (genreParam) {
      setActiveGenres([decodeURIComponent(genreParam)])
      setGenreFilterOpen(true)
    }
    
    // Read language
    const languageParam = params.get('language')
    if (languageParam) {
      setLanguageFilter(decodeURIComponent(languageParam))
    }
    
    // Read search
    const searchParam = params.get('search')
    if (searchParam) {
      setSearchQuery(decodeURIComponent(searchParam))
    }
    
    // Read sort
    const sortParam = params.get('sort')
    if (sortParam) {
      setSortBy(decodeURIComponent(sortParam))
    }
    
    // Read sort direction
    const directionParam = params.get('direction')
    if (directionParam) {
      setSortDirection(decodeURIComponent(directionParam))
    }
    
    // Read chapter filter
    const chapterModeParam = params.get('chapterMode')
    const chapterValueParam = params.get('chapterValue')
    if (chapterValueParam) {
      setChapterFilter({
        mode: chapterModeParam || 'max',
        value: Number(chapterValueParam)
      })
      setChapterFilterOpen(true)
    }
  }, [])

  // Save filters to URL query params
  useEffect(() => {
    // Build query string from current filters
    const params = new URLSearchParams()
    
    if (activeShelf && activeShelf !== 'all') {
      params.set('shelf', activeShelf)
    }
    if (activeGenres.length > 0) {
      params.set('genre', activeGenres[0])
    }
    if (languageFilter && languageFilter !== 'all') {
      params.set('language', languageFilter)
    }
    if (searchQuery) {
      params.set('search', searchQuery)
    }
    if (sortBy && sortBy !== 'created') {
      params.set('sort', sortBy)
    }
    if (sortDirection !== 'desc') {
      params.set('direction', sortDirection)
    }
    if (chapterFilter.value !== null) {
      params.set('chapterMode', chapterFilter.mode)
      params.set('chapterValue', chapterFilter.value)
    }
    
    const queryString = params.toString()
    const newUrl = queryString ? `?${queryString}` : window.location.pathname
    
    // Update URL without pushing to history
    window.history.replaceState(null, '', newUrl)
  }, [activeShelf, activeGenres, languageFilter, searchQuery, sortBy, sortDirection, chapterFilter])

  // Load custom shelves
  useEffect(() => {
    let mounted = true
    async function load() {
      if (!user) return
      setLoading(true)
      setError('')
      try {
        const shelves = await getShelves(user.id)
        if (mounted) {
          setCustomShelves(shelves)
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
  }, [user])

  // Sync loading state with context
  useEffect(() => {
    setLoading(contextLoading)
  }, [contextLoading])

  // Calculate shelf counts
  const getShelfCount = (shelfId) => {
    if (shelfId === 'all') return books.length
    const statusKeys = ['reading', 'plan_to_read', 'waiting', 'completed', 'dropped', 'on_hold']
    if (statusKeys.includes(shelfId)) {
      return books.filter((b) => b.status === shelfId).length
    }
    return books.filter((b) => b.shelves?.includes(shelfId)).length
  }

  // Get all unique genres from books
  const allGenres = [...new Set(books.flatMap((b) => b.genres ?? []))].sort()
  const allLanguages = [...new Set(books.map((b) => b.language).filter(Boolean))].sort()

  // Filter and sort books
  const getFilteredBooks = () => {
    let filtered = [...books]
    let relevanceScores = new Map()

    // Filter by shelf
    if (activeShelf !== 'all') {
      const statusKeys = ['reading', 'plan_to_read', 'waiting', 'completed', 'dropped', 'on_hold']
      if (statusKeys.includes(activeShelf)) {
        filtered = filtered.filter((book) => book.status === activeShelf)
      } else {
        filtered = filtered.filter((book) => book.shelves?.includes(activeShelf))
      }
    }

    // Filter by genres
    if (activeGenres.length > 0) {
      if (genreFilterMode === 'all') {
        filtered = filtered.filter((book) => activeGenres.every((genre) => book.genres?.includes(genre)))
      } else {
        filtered = filtered.filter((book) => activeGenres.some((genre) => book.genres?.includes(genre)))
      }
    }

    // Filter by language
    if (languageFilter !== 'all') {
      filtered = filtered.filter((book) => (book.language ?? '') === languageFilter)
    }

    // Filter by chapter count
    if (chapterFilter.value !== null) {
      filtered = filtered.filter((book) => {
        const count = book.chapter_count
        if (count === null || count === undefined) return false
        if (chapterFilter.mode === 'max') {
          return count <= chapterFilter.value
        } else {
          return count >= chapterFilter.value
        }
      })
    }

    // Search filter with relevance scoring
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const queryWords = query.split(/\s+/).filter((w) => w.length > 0)

      // Score all books by relevance match (don't require all words)
      const scored = filtered.map((book) => {
        const titleLower = book.title.toLowerCase()
        const descLower = (book.description || '').toLowerCase()
        let score = 0

        let titleMatches = 0
        let descMatches = 0

        // Count how many query words match in each field
        queryWords.forEach((word) => {
          if (titleLower.includes(word)) {
            titleMatches++
            score += 10
          }
          if (descLower.includes(word)) {
            descMatches++
            score += 2
          }
        })

        // Boost score based on match ratio (more matches = better)
        const totalMatches = titleMatches + descMatches
        const maxPossibleMatches = queryWords.length * 2
        const matchRatio = totalMatches / maxPossibleMatches
        score += matchRatio * 100

        // Significant bonus if all words found in title
        if (queryWords.every((w) => titleLower.includes(w))) {
          score += 50
        }

        // Bonus for title-only matches (description-only is less relevant)
        score += (titleMatches / queryWords.length) * 30

        return { book, score }
      })

      // Filter to only books with at least one word match, then sort by relevance
      const filteredScored = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score)
      relevanceScores = new Map(filteredScored.map((s) => [s.book.id, s.score]))
      filtered = filteredScored.map((s) => s.book)
    }

    // Sort
    switch (sortBy) {
      case 'relevance':
        filtered.sort((a, b) => (relevanceScores.get(b.id) ?? 0) - (relevanceScores.get(a.id) ?? 0))
        break
      case 'score':
        filtered.sort((a, b) => Number(b.score ?? -1) - Number(a.score ?? -1))
        break
      case 'chapter_count':
        filtered.sort((a, b) => Number(b.chapter_count ?? -1) - Number(a.chapter_count ?? -1))
        break
      case 'title':
        filtered.sort((a, b) => a.title.localeCompare(b.title))
        break
      case 'status':
        filtered.sort((a, b) =>
          (STATUS[a.status] ?? a.status).localeCompare(STATUS[b.status] ?? b.status)
        )
        break
      case 'updated':
        filtered.sort(
          (a, b) => new Date(b.last_uploaded_at ?? 0) - new Date(a.last_uploaded_at ?? 0)
        )
        break
      case 'created':
      default:
        filtered.sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        )
        break
    }

    // Apply direction
    if (sortDirection === 'asc' && sortBy !== 'relevance') {
      filtered.reverse()
    }

    return filtered
  }

  // Shelf management
  const handleCreateShelf = async (shelfName) => {
    if (!user) return
    const shelf = await createShelf(user.id, shelfName)
    setCustomShelves([...customShelves, shelf])
  }

  const handleDeleteShelf = async (shelfId) => {
    if (confirm(`Delete this shelf? Books will not be deleted, just removed from this list.`)) {
      await deleteShelf(shelfId)
      setCustomShelves(customShelves.filter((s) => s.id !== shelfId))
      setBooks(
        books.map((book) => ({
          ...book,
          shelves: book.shelves?.filter((s) => s !== shelfId) ?? [],
        }))
      )
      if (activeShelf === shelfId) setActiveShelf('all')
    }
  }

  const handleToggleBookShelf = async (bookId, shelfId) => {
    await toggleBookShelf(bookId, shelfId)
    setBooks(
      books.map((book) => {
        if (book.id === bookId) {
          const currentShelves = book.shelves ?? []
          const isInShelf = currentShelves.includes(shelfId)
          return {
            ...book,
            shelves: isInShelf
              ? currentShelves.filter((s) => s !== shelfId)
              : [...currentShelves, shelfId],
          }
        }
        return book
      })
    )
  }

  // Update checking
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  const handleCheckWaitingUpdates = async () => {
    if (checkingWaiting) return
    setCheckingWaiting(true)
    setUpdateMessage('')
    setError('')
    setErrorDetails([])
    setShowErrors(false)
    setUpdateDetails([])
    setWaitingProgress({ current: 0, total: 0 })
    const normalizeCount = (val) => {
      const n = Number(val)
      if (!Number.isFinite(n) || n <= 0) return null
      return Math.round(n)
    }
    const normalizeText = (val) => {
      if (val === null || val === undefined) return ''
      return String(val).trim()
    }
    const now = new Date().toISOString()
    const batchSize = 3
    const delayMs = 1000
    try {
      const waitingBooks = books.filter((b) => b.status === 'waiting')
      if (waitingBooks.length === 0) {
        setUpdateMessage('No waiting books to check.')
        return
      }

      setWaitingProgress({ current: 0, total: waitingBooks.length })

      const updatedIds = new Set()
      const updates = []

      for (let i = 0; i < waitingBooks.length; i += batchSize) {
        const batch = waitingBooks.slice(i, i + batchSize)
            const batchResults = await Promise.all(
              batch.map(async (book) => {
            const url = book.sources?.[0]?.url
            if (!url) return { bookId: book.id, title: book.title, skipped: 'no_url' }

            const { data: payload, error: fnError } = await supabase.functions.invoke('fetch-latest', {
              body: { url },
            })

            if (fnError || !payload) return { bookId: book.id, title: book.title, error: fnError?.message || 'fetch failed' }

            const payloadLatest = normalizeText(payload.latest_chapter)
            const payloadUploaded = payload.last_uploaded_at
            const payloadCount = normalizeCount(payload.chapter_count)

            const latestHasText = payloadLatest !== ''
            const uploadHasValue = Boolean(payloadUploaded)
            const countHasValue = payloadCount !== null
            const emptyPayload = !latestHasText && !uploadHasValue && !countHasValue

            if (emptyPayload) {
              return { bookId: book.id, title: book.title, payload, skipped: 'empty_payload' }
            }

            // Compare latest chapter: normalize both strings and check if they differ
            const normalizedCurrentLatest = normalizeText(book.latest_chapter)
            const hasLatestChange = latestHasText && payloadLatest !== normalizedCurrentLatest

            // Compare upload dates: only count as change if dates are different days (ignore time of day)
            const parsedPayloadUpload = uploadHasValue ? new Date(payloadUploaded) : null
            const parsedCurrentUpload = book.last_uploaded_at ? new Date(book.last_uploaded_at) : null
            const payloadUploadMs = parsedPayloadUpload && !isNaN(parsedPayloadUpload) ? parsedPayloadUpload.getTime() : null
            const currentUploadMs = parsedCurrentUpload && !isNaN(parsedCurrentUpload) ? parsedCurrentUpload.getTime() : null
            const payloadUploadDate = payloadUploadMs ? new Date(payloadUploadMs).toISOString().split('T')[0] : null
            const currentUploadDate = currentUploadMs ? new Date(currentUploadMs).toISOString().split('T')[0] : null
            const hasUploadChange = uploadHasValue && payloadUploadDate !== currentUploadDate

            const currentCount = normalizeCount(book.chapter_count)
            const hasCountChange = countHasValue && payloadCount !== currentCount

            // Determine if any field changed (latest chapter, upload date, or chapter count)
            const hasChange = hasLatestChange || hasUploadChange || hasCountChange

            if (!hasChange) {
              return { bookId: book.id, title: book.title, payload, skipped: 'no_change' }
            }

            if (hasChange) {
              const { error: updateError } = await supabase
                .from('books')
                .update({
                  latest_chapter: hasLatestChange ? payloadLatest : book.latest_chapter,
                  last_uploaded_at: hasUploadChange ? payloadUploaded : book.last_uploaded_at,
                  chapter_count: hasCountChange ? payloadCount : book.chapter_count,
                  last_fetched_at: now,
                })
                .eq('id', book.id)

              if (!updateError) {
                updatedIds.add(book.id)
              }
            }

            const changes = []
            if (hasLatestChange) changes.push(`Latest: ${normalizedCurrentLatest || '—'} → ${payloadLatest || '—'}`)
            if (hasUploadChange) changes.push(`Upload: ${book.last_uploaded_at ? new Date(book.last_uploaded_at).toLocaleString() : '—'} → ${payloadUploaded ? new Date(payloadUploaded).toLocaleString() : '—'}`)
            if (hasCountChange) changes.push(`Chapters: ${book.chapter_count ?? '—'} → ${payloadCount}`)

            return { bookId: book.id, title: book.title, payload, updated: hasChange, changes }
          })
        )

        updates.push(...batchResults)
        setWaitingProgress({ current: Math.min(waitingBooks.length, (i + batch.length)), total: waitingBooks.length })

        // Throttle between batches (skip after last batch)
        if (i + batchSize < waitingBooks.length) {
          await sleep(delayMs)
        }
      }

      const updatesById = new Map(updates.map((u) => [u.bookId, u]))
      const updatedDetails = updates
        .filter((u) => u.updated && u.changes?.length)
        .map((u) => ({ title: u.title, changes: u.changes }))

      const emptyPayloadCount = updates.filter((u) => u.skipped === 'empty_payload').length
      const noChangeCount = updates.filter((u) => u.skipped === 'no_change').length
      const noUrlCount = updates.filter((u) => u.skipped === 'no_url').length
      const errorCount = updates.filter((u) => u.error).length
      const skippedCount = emptyPayloadCount + noChangeCount + noUrlCount

      const errorItems = updates
        .filter((u) => u.error)
        .map((u) => ({
          bookId: u.bookId,
          title: u.title,
          message: u.error,
        }))
      setErrorDetails(errorItems)
      if (errorItems.length === 0) setShowErrors(false)

      setBooks((prev) =>
        prev.map((book) => {
          const result = updatesById.get(book.id)
          const payload = result?.payload
          if (payload && updatedIds.has(book.id)) {
            const payloadLatest = payload.latest_chapter
            const payloadUploaded = payload.last_uploaded_at
              const payloadCount = normalizeCount(payload.chapter_count)
            const hasLatestChange = payloadLatest && payloadLatest !== book.latest_chapter
            const hasUploadChange = payloadUploaded && payloadUploaded !== book.last_uploaded_at
              const hasCountChange = payloadCount !== null && payloadCount !== book.chapter_count
            return {
              ...book,
              latest_chapter: hasLatestChange ? payloadLatest : book.latest_chapter,
              last_uploaded_at: hasUploadChange ? payloadUploaded : book.last_uploaded_at,
                chapter_count: hasCountChange ? payloadCount : book.chapter_count,
              last_fetched_at: now,
            }
          }
          return book
        })
      )

      const summaryParts = [
        `Checked ${waitingBooks.length} waiting books`,
        `updated ${updatedIds.size}`,
      ]

      if (skippedCount) {
        summaryParts.push(`skipped ${skippedCount}`)
      }
      if (errorCount) summaryParts.push(`errors ${errorCount}`)

      setUpdateMessage(summaryParts.join('; ') + '.')
      setUpdateDetails(updatedDetails)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCheckingWaiting(false)
      setWaitingProgress({ current: 0, total: 0 })
    }
  }

  const filteredBooks = getFilteredBooks()
  const totalPages = Math.ceil(filteredBooks.length / booksPerPage)
  const startIndex = (currentPage - 1) * booksPerPage
  const endIndex = startIndex + booksPerPage
  const paginatedBooks = filteredBooks.slice(startIndex, endIndex)

  // First effect: restore page state and handle skip-restore
  useEffect(() => {
    if (scrollRestored) return
    const skipRestore = sessionStorage.getItem('bookshelfSkipRestore')
    if (skipRestore) {
      sessionStorage.removeItem('bookshelfSkipRestore')
      sessionStorage.removeItem('bookshelfAnchor')
      sessionStorage.removeItem('bookshelfScrollPos')
      sessionStorage.removeItem('bookshelfPage')
      window.scrollTo({ top: 0, behavior: 'auto' })
      setScrollRestored(true)
      return
    }
    
    const savedPage = Number(sessionStorage.getItem('bookshelfPage'))
    if (Number.isFinite(savedPage) && savedPage > 0 && savedPage !== currentPage) {
      setCurrentPage(savedPage)
      // Don't set scrollRestored yet; let the second effect handle scrolling
      return
    }
    
    // If page didn't need updating, proceed to scroll restoration
    setScrollRestored(true)
  }, [scrollRestored, currentPage])

  // Second effect: scroll after page state and DOM are ready
  useEffect(() => {
    if (!scrollRestored) return
    const anchorId = sessionStorage.getItem('bookshelfAnchor')
    const savedScrollPos = sessionStorage.getItem('bookshelfScrollPos')
    const pos = savedScrollPos ? parseInt(savedScrollPos, 10) : 0

    const scrollToSaved = () => {
      const offset = getNavOffset()
      const anchorEl = anchorId ? document.querySelector(`[data-book-id="${anchorId}"]`) : null
      if (anchorEl) {
        const top = anchorEl.getBoundingClientRect().top + window.scrollY
        window.scrollTo({ top: Math.max(top - offset, 0), behavior: 'auto' })
      } else if (pos > 0) {
        window.scrollTo({ top: Math.max(pos - offset, 0), behavior: 'auto' })
      }
    }

    // Delay to allow images/layout to settle
    let timeoutId
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToSaved()
        // Re-apply scroll again after a delay to counter image loading shifts
        timeoutId = setTimeout(scrollToSaved, 300)
      })
    })

    sessionStorage.removeItem('bookshelfAnchor')
    return () => clearTimeout(timeoutId)
  }, [scrollRestored, paginatedBooks.length])

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Library</p>
          <h1>Bookshelf</h1>
          <p className="muted">Browse, filter, and organize your collection</p>
        </div>
        <Link to="/add" className="primary">
          Smart Add
        </Link>
      </div>

      <div className="bookshelf-layout">
        {/* Sidebar with shelves */}
        <ShelfSidebar
          statusShelves={statusShelves}
          customShelves={customShelves}
          activeShelf={activeShelf}
          onShelfChange={setActiveShelf}
          onDeleteShelf={handleDeleteShelf}
          onCreateShelf={handleCreateShelf}
          getShelfCount={getShelfCount}
        />

        {/* Main content area */}
        <div className="shelf-content">
          {/* Filters and search */}
          <div className="shelf-controls">
            <label className="field shelf-search">
              <span>Search</span>
              <input
                type="text"
                placeholder="Search by title or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </label>
            <div className="shelf-controls-row">
              <label className="field min-w-180">
                <span>Sort by</span>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="ghost sort-direction-button"
                onClick={() => setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc')}
                title={sortDirection === 'desc' ? 'Descending' : 'Ascending'}
              >
                {sortDirection === 'desc' ? '↓' : '↑'}
              </button>
              <label className="field min-w-160">
                <span>Language</span>
                <select value={languageFilter} onChange={(e) => setLanguageFilter(e.target.value)}>
                  <option value="all">All languages</option>
                  {allLanguages.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* Genre filter */}
          <GenreFilter
            allGenres={allGenres}
            activeGenres={activeGenres}
            onGenreChange={setActiveGenres}
            genreFilterMode={genreFilterMode}
            onGenreFilterModeChange={setGenreFilterMode}
            isOpen={genreFilterOpen}
            onOpenChange={setGenreFilterOpen}
          />

          {/* Chapter count filter */}
          <ChapterCountFilter
            chapterFilter={chapterFilter}
            onChapterFilterChange={setChapterFilter}
            isOpen={chapterFilterOpen}
            onOpenChange={setChapterFilterOpen}
          />

          {/* Results count with check updates button for waiting shelf */}
          <div className="results-header" id="bookshelf-results" ref={resultsRef}>
            <p className="muted">
              {filteredBooks.length} {filteredBooks.length === 1 ? 'book' : 'books'} found{' '}
              {loading && '(loading...)'}
            </p>
            {activeShelf === 'waiting' && filteredBooks.length > 0 && (
              <button
                className="primary text-small"
                onClick={handleCheckWaitingUpdates}
                disabled={checkingWaiting}
              >
                {checkingWaiting ? 'Checking…' : 'Check Updates'}
              </button>
            )}
          </div>

          {checkingWaiting && waitingProgress.total > 0 && (
            <div className="notice mb-12">
              <p className="muted m-0">
                Checking {waitingProgress.current}/{waitingProgress.total} (throttled)
              </p>
              <div className="progress-container">
                <div
                  style={{
                    width: `${Math.round((waitingProgress.current / waitingProgress.total) * 100)}%`,
                    height: '100%',
                    background: 'var(--accent)',
                  }}
                />
              </div>
            </div>
          )}

          {updateMessage && (
            <p className="muted mb-12">
              {updateMessage}
            </p>
          )}

          {updateDetails.length > 0 && (
            <div className="notice">
              <p className="success m-0 font-semibold">Updates</p>
              <ul className="muted update-list">
                {updateDetails.map((item, idx) => (
                  <li key={`${item.title}-${idx}`}>
                    <strong>{item.title || 'Untitled'}</strong>
                    <ul className="nested-list">
                      {item.changes.map((change, cidx) => (
                        <li key={cidx}>{change}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {errorDetails.length > 0 && (
            <div className="notice">
              <div className="flex justify-between items-center gap-12">
                <p className="error m-0 font-semibold">
                  {errorDetails.length} error{errorDetails.length === 1 ? '' : 's'} during update
                </p>
                <button
                  type="button"
                  className="secondary text-small"
                  onClick={() => setShowErrors((v) => !v)}
                >
                  {showErrors ? 'Hide errors' : 'Show errors'}
                </button>
              </div>
              {showErrors && (
                <ul className="muted error-list">
                  {errorDetails.map((err) => (
                    <li key={err.bookId} className="error-item">
                      <strong>{err.title || 'Untitled'}</strong>: {err.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {error && <p className="error">{error}</p>}

          {/* Book grid */}
          <BookGrid
            books={paginatedBooks}
            loading={loading}
            customShelves={customShelves}
            onAddToShelf={handleToggleBookShelf}
            activeGenres={activeGenres}
            setActiveGenres={setActiveGenres}
            onOpenBook={handleBookOpen}
          />

          {/* Pagination Controls (bottom) */}
          {totalPages > 1 && (
            <div className="pagination-controls">
              <div className="pagination-info">
                Showing {startIndex + 1}–{Math.min(endIndex, filteredBooks.length)} of {filteredBooks.length} books
              </div>
              <div className="pagination-buttons">
                <button
                  className="ghost"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  ← Previous
                </button>
                <select
                  className="page-selector"
                  value={currentPage}
                  onChange={(e) => setCurrentPage(Number(e.target.value))}
                >
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <option key={page} value={page}>
                      Page {page}
                    </option>
                  ))}
                </select>
                <button
                  className="ghost"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next →
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

export default Bookshelf
