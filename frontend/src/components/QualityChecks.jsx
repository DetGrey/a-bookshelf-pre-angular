import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import { uploadImageToProxy } from '../lib/imageProxy.js'

function QualityChecks({ books, loading }) {
  const [dupeLoading, setDupeLoading] = useState(false)
  const [dupeResults, setDupeResults] = useState([])
  const [dupeMessage, setDupeMessage] = useState('')
  const [staleWaitingBooks, setStaleWaitingBooks] = useState([])
  const [staleCheckMessage, setStaleCheckMessage] = useState('')
  const [coverLoading, setCoverLoading] = useState(false)
  const [coverResults, setCoverResults] = useState({ failed: [], successful: [] })
  const [coverMessage, setCoverMessage] = useState('')
  const [coverProgress, setCoverProgress] = useState({ checked: 0, total: 0 })
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')

  // Duplicate title finder (simple Dice coefficient over bigrams + substring check)
  const normalizeTitle = (title = '') => title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  const bigrams = (text) => {
    if (!text) return []
    if (text.length === 1) return [text]
    const grams = []
    for (let i = 0; i < text.length - 1; i += 1) {
      grams.push(text.slice(i, i + 2))
    }
    return grams
  }
  const diceSimilarity = (a, b) => {
    const aBigrams = bigrams(a)
    const bBigrams = bigrams(b)
    if (!aBigrams.length || !bBigrams.length) return 0
    const counts = new Map()
    aBigrams.forEach((g) => counts.set(g, (counts.get(g) || 0) + 1))
    let overlap = 0
    bBigrams.forEach((g) => {
      const count = counts.get(g) || 0
      if (count > 0) {
        overlap += 1
        counts.set(g, count - 1)
      }
    })
    return (2 * overlap) / (aBigrams.length + bBigrams.length)
  }

  const handleFindDuplicates = async () => {
    // Check cache first (15 min = 900000ms)
    const cached = sessionStorage.getItem('dupeCache')
    if (cached) {
      const { data, timestamp } = JSON.parse(cached)
      if (Date.now() - timestamp < 900000) {
        setDupeResults(data)
        setDupeMessage(data.length ? '' : 'No likely duplicates found.')
        return
      }
    }

    setDupeLoading(true)
    setDupeResults([])
    setDupeMessage('')

    // Build a set of related pairs so we can skip known intentional links
    const bookIds = books.map((b) => b.id)
    if (bookIds.length === 0) {
      setDupeMessage('No books to check.')
      setDupeLoading(false)
      return
    }
    const relatedPairs = new Set()

    try {
      const { data: forward, error: forwardError } = await supabase
        .from('related_books')
        .select('book_id, related_book_id')
        .in('book_id', bookIds)
      if (forwardError) throw forwardError

      const { data: reverse, error: reverseError } = await supabase
        .from('related_books')
        .select('book_id, related_book_id')
        .in('related_book_id', bookIds)
      if (reverseError) throw reverseError

      ;[...(forward ?? []), ...(reverse ?? [])].forEach((r) => {
        if (!r.book_id || !r.related_book_id) return
        const [a, b] = r.book_id < r.related_book_id ? [r.book_id, r.related_book_id] : [r.related_book_id, r.book_id]
        relatedPairs.add(`${a}-${b}`)
      })
    } catch (err) {
      setDupeMessage(err instanceof Error ? err.message : 'Failed to check duplicates')
      setDupeLoading(false)
      return
    }

    const normalized = books
      .map((b) => ({
        ...b,
        norm: normalizeTitle(b.title || ''),
      }))
      .filter((b) => b.norm.length > 0)

    const pairs = []
    for (let i = 0; i < normalized.length; i += 1) {
      for (let j = i + 1; j < normalized.length; j += 1) {
        const a = normalized[i]
        const b = normalized[j]

        // Skip if the books are already linked as related
        const key = a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`
        if (relatedPairs.has(key)) continue

        const sim = diceSimilarity(a.norm, b.norm)
        const contains = a.norm.includes(b.norm) || b.norm.includes(a.norm)
        if (sim >= 0.7 || contains) {
          pairs.push({
            a,
            b,
            score: Math.max(sim, contains ? 0.7 : sim),
          })
        }
      }
    }

    pairs.sort((x, y) => y.score - x.score)
    setDupeResults(pairs)
    setDupeMessage(pairs.length ? '' : 'No likely duplicates found.')
    // Cache for 15 minutes
    sessionStorage.setItem('dupeCache', JSON.stringify({ data: pairs, timestamp: Date.now() }))
    setDupeLoading(false)
  }

  const handleCheckStaleWaiting = () => {
    // Check cache first (15 min = 900000ms)
    const cached = sessionStorage.getItem('staleCache')
    if (cached) {
      const { data, timestamp } = JSON.parse(cached)
      if (Date.now() - timestamp < 900000) {
        setStaleWaitingBooks(data)
        setStaleCheckMessage(
          data.length
            ? `Found ${data.length} book${data.length > 1 ? 's' : ''} that may need status update`
            : 'All waiting books appear active'
        )
        return
      }
    }

    setStaleWaitingBooks([])
    setStaleCheckMessage('')
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    
    const waitingBooks = books.filter((b) => b.status === 'waiting')
    const staleBooks = waitingBooks.filter((book) => {
      // Check if series has ended (but not season end)
      const chapterLower = (book.latest_chapter || '').toLowerCase()
      const hasEnd = chapterLower.includes('end')
      const isSeasonEnd = /season\s*\d+\s*end|s\d+\s*end/i.test(chapterLower)
      const seriesEnded = hasEnd && !isSeasonEnd
      
      // Check if not updated in 6+ months
      let isStale = false
      if (book.last_uploaded_at) {
        const lastUpload = new Date(book.last_uploaded_at)
        isStale = lastUpload < sixMonthsAgo
      }
      
      return seriesEnded || isStale
    })
    
    staleBooks.sort((a, b) => {
      const dateA = new Date(a.last_uploaded_at || 0)
      const dateB = new Date(b.last_uploaded_at || 0)
      return dateA - dateB
    })
    
    setStaleWaitingBooks(staleBooks)
    setStaleCheckMessage(
      staleBooks.length
        ? `Found ${staleBooks.length} book${staleBooks.length > 1 ? 's' : ''} that may need status update`
        : 'All waiting books appear active'
    )
    // Cache for 15 minutes
    sessionStorage.setItem('staleCache', JSON.stringify({ data: staleBooks, timestamp: Date.now() }))
  }

  const handleCheckCovers = async () => {
    // Check cache first (15 min = 900000ms)
    const cached = sessionStorage.getItem('coverCache')
    if (cached) {
      const { data, timestamp } = JSON.parse(cached)
      if (Date.now() - timestamp < 900000) {
        setCoverResults(data)
        setCoverProgress({ checked: 0, total: 0 })
        const totalIssues = data.failed.length + data.successful.length
        setCoverMessage(
          totalIssues
            ? `Found ${data.failed.length} failed cover${data.failed.length !== 1 ? 's' : ''} and ${data.successful.length} uploadable cover${data.successful.length !== 1 ? 's' : ''}`
            : 'All covers are accessible and from Cloudflare'
        )
        return
      }
    }

    setCoverLoading(true)
    setCoverResults({ failed: [], successful: [] })
    setCoverMessage('')
    setUploadMessage('')

    const workerUrl = import.meta.env.VITE_IMAGE_PROXY_URL
    const failedCovers = []
    const successfulNonCloudflare = []

    // Helper to test if an image can be loaded
    const testImage = (url) => {
      return new Promise((resolve) => {
        const img = new Image()
        img.onload = () => resolve(true)
        img.onerror = () => resolve(false)
        // Short timeout (3 seconds)
        setTimeout(() => resolve(false), 3000)
        img.src = url
      })
    }

    // Test images in parallel batches of 10 to speed up the process
    const booksWithCovers = books.filter((book) => book.cover_url)
    const batchSize = 10
    
    setCoverProgress({ checked: 0, total: booksWithCovers.length })
    
    for (let i = 0; i < booksWithCovers.length; i += batchSize) {
      const batch = booksWithCovers.slice(i, i + batchSize)
      const results = await Promise.all(
        batch.map(async (book) => {
          const isCloudflare = workerUrl && book.cover_url.startsWith(workerUrl)
          const canLoad = await testImage(book.cover_url)
          return { book, canLoad, isCloudflare }
        })
      )

      results.forEach(({ book, canLoad, isCloudflare }) => {
        if (!canLoad) {
          failedCovers.push(book)
        } else if (!isCloudflare) {
          successfulNonCloudflare.push(book)
        }
      })
      
      // Update progress after each batch
      setCoverProgress({ checked: Math.min(i + batchSize, booksWithCovers.length), total: booksWithCovers.length })
    }

    const results = {
      failed: failedCovers,
      successful: successfulNonCloudflare,
    }

    setCoverResults(results)
    const totalIssues = failedCovers.length + successfulNonCloudflare.length
    setCoverMessage(
      totalIssues
        ? `Found ${failedCovers.length} failed cover${failedCovers.length !== 1 ? 's' : ''} and ${successfulNonCloudflare.length} uploadable cover${successfulNonCloudflare.length !== 1 ? 's' : ''}`
        : 'All covers are accessible and from Cloudflare'
    )

    // Cache for 15 minutes
    sessionStorage.setItem('coverCache', JSON.stringify({ data: results, timestamp: Date.now() }))
    setCoverLoading(false)
    setCoverProgress({ checked: 0, total: 0 })
  }

  const handleUploadCovers = async () => {
    if (coverResults.successful.length === 0) return

    setUploadLoading(true)
    setUploadMessage('')

    let successCount = 0
    let failCount = 0
    const failed = []

    for (const book of coverResults.successful) {
      try {
        // Upload to Cloudflare
        const newUrl = await uploadImageToProxy(book.cover_url)
        
        // Check if the upload actually changed the URL (meaning it succeeded)
        if (newUrl !== book.cover_url) {
          // Update the database
          const { error } = await supabase
            .from('books')
            .update({ cover_url: newUrl })
            .eq('id', book.id)

          if (error) {
            console.error('Database update failed for', book.title, error)
            failCount++
            failed.push(book.title)
          } else {
            successCount++
          }
        } else {
          // Upload didn't change URL (failed)
          failCount++
          failed.push(book.title)
        }
      } catch (error) {
        console.error('Upload failed for', book.title, error)
        failCount++
        failed.push(book.title)
      }
    }

    setUploadMessage(
      `Uploaded ${successCount} cover${successCount !== 1 ? 's' : ''} to Cloudflare. ${
        failCount > 0 ? `${failCount} failed: ${failed.join(', ')}` : ''
      }`
    )

    // Remove successfully uploaded books from the successful list
    setCoverResults((prev) => ({
      ...prev,
      successful: prev.successful.filter((book) => failed.includes(book.title)),
    }))

    // Clear cache to force re-check
    sessionStorage.removeItem('coverCache')

    setUploadLoading(false)
  }

  return (
    <>
      <section className="card quality-check-section">
        <div className="block-head quality-check-header">
          <div>
            <p className="eyebrow m-0">Quality check</p>
            <h2 className="m-0">Find possible duplicate titles</h2>
          </div>
          <button
            className="ghost quality-check-button"
            onClick={handleFindDuplicates}
            disabled={dupeLoading || loading || books.length === 0}
          >
            {dupeLoading ? 'Scanning…' : 'Scan for duplicates'}
          </button>
        </div>
        {dupeMessage && <p className="muted mt-4">{dupeMessage}</p>}
        {dupeResults.length > 0 && (
          <div className="stack duplicate-results">
            {dupeResults.map(({ a, b, score }) => (
              <div key={`${a.id}-${b.id}`} className="card duplicate-item-card">
                <div className="duplicate-comparison">
                  <div className="duplicate-titles-wrapper">
                    <div className="duplicate-titles-list">
                      <Link to={`/book/${a.id}`} target="_blank" rel="noreferrer">
                        <strong>{a.title}</strong>
                      </Link>
                      <Link to={`/book/${b.id}`} target="_blank" rel="noreferrer" className="muted duplicate-vs-link">
                        vs. {b.title}
                      </Link>
                    </div>
                  </div>
                  <span className="pill ghost similarity-percentage">Similarity {(score * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card quality-check-section">
        <div className="block-head quality-check-header">
          <div>
            <p className="eyebrow m-0">Quality check</p>
            <h2 className="m-0">Stale waiting books</h2>
            <p className="muted m-0">Books in waiting that haven't updated in 6+ months or have ended</p>
          </div>
          <button
            className="ghost quality-check-button"
            onClick={handleCheckStaleWaiting}
            disabled={loading || books.length === 0}
          >
            Check for stale books
          </button>
        </div>
        {staleCheckMessage && <p className="muted mt-4">{staleCheckMessage}</p>}
        {staleWaitingBooks.length > 0 && (
          <div className="stack duplicate-results">
            {staleWaitingBooks.map((book) => {
              const chapterLower = (book.latest_chapter || '').toLowerCase()
              const hasEnd = chapterLower.includes('end')
              const isSeasonEnd = /season\s*\d+\s*end|s\d+\s*end/i.test(chapterLower)
              const seriesEnded = hasEnd && !isSeasonEnd
              
              const lastUpload = book.last_uploaded_at ? new Date(book.last_uploaded_at) : null
              const monthsAgo = lastUpload ? Math.floor((Date.now() - lastUpload.getTime()) / (1000 * 60 * 60 * 24 * 30)) : null
              
              let reason = ''
              let badge = ''
              if (seriesEnded) {
                reason = `Series ended: "${book.latest_chapter}"`
                badge = 'Ended'
              } else if (monthsAgo !== null) {
                reason = `Last update: ${lastUpload.toLocaleDateString()} (${monthsAgo} months ago)`
                badge = `${monthsAgo} months`
              }
              
              return (
                <div key={book.id} className="card duplicate-item-card">
                  <div className="duplicate-comparison">
                    <div className="duplicate-titles-wrapper">
                      <div className="duplicate-titles-list">
                        <Link to={`/book/${book.id}`}>
                          <strong>{book.title}</strong>
                        </Link>
                        <p className="muted text-small-muted">
                          {reason}
                        </p>
                      </div>
                    </div>
                    <span className="pill ghost">{badge}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="card quality-check-section">
        <div className="block-head quality-check-header">
          <div>
            <p className="eyebrow m-0">Quality check</p>
            <h2 className="m-0">Cover image issues</h2>
            <p className="muted m-0">Find broken cover images and upload external covers to Cloudflare</p>
          </div>
          <button
            className="ghost quality-check-button"
            onClick={handleCheckCovers}
            disabled={coverLoading || loading || books.length === 0}
          >
            {coverLoading ? 'Checking…' : 'Check covers'}
          </button>
        </div>
        {coverLoading && coverProgress.total > 0 && (
          <p className="muted mt-4">
            Checking covers: {coverProgress.checked} / {coverProgress.total}
          </p>
        )}
        {!coverLoading && coverMessage && <p className="muted mt-4">{coverMessage}</p>}
        {uploadMessage && <p className="muted mt-2">{uploadMessage}</p>}

        {coverResults.failed.length > 0 && (
          <div className="stack mt-4">
            <div className="flex items-center gap-2">
              <h3 className="m-0">Failed covers ({coverResults.failed.length})</h3>
              <span className="pill ghost">Needs manual fix</span>
            </div>
            <div className="stack duplicate-results">
              {coverResults.failed.map((book) => (
                <div key={book.id} className="card duplicate-item-card">
                  <Link to={`/book/${book.id}`}>
                    <strong>{book.title}</strong>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {coverResults.successful.length > 0 && (
          <div className="stack mt-4">
            <div className="flex items-center gap-2">
              <h3 className="m-0">Uploadable to Cloudflare ({coverResults.successful.length})</h3>
              <button
                className="primary"
                onClick={handleUploadCovers}
                disabled={uploadLoading}
              >
                {uploadLoading ? 'Uploading…' : 'Upload to Cloudflare'}
              </button>
            </div>
            <div className="stack duplicate-results">
              {coverResults.successful.map((book) => (
                <div key={book.id} className="card duplicate-item-card">
                  <div className="duplicate-comparison">
                    <Link to={`/book/${book.id}`}>
                      <strong>{book.title}</strong>
                    </Link>
                    <span className="muted text-small-muted" style={{ wordBreak: 'break-all' }}>
                      {book.cover_url}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  )
}

export default QualityChecks
