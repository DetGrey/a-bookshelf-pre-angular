import { useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import '../styles/genre-consolidator.css'

function GenreConsolidator({ books, loading, onRefresh }) {
  const [consolidateLoading, setConsolidateLoading] = useState(false)
  const [similarGenres, setSimilarGenres] = useState([])
  const [consolidateMessage, setConsolidateMessage] = useState('')
  const [selectedPairs, setSelectedPairs] = useState(new Set())
  const [merging, setMerging] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [customMerging, setCustomMerging] = useState(false)

  // Normalize genre for comparison
  const normalizeGenre = (genre = '') => 
    genre.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ')

  // Calculate similarity between two strings
  const stringSimilarity = (a, b) => {
    const normalized_a = normalizeGenre(a)
    const normalized_b = normalizeGenre(b)
    
    if (normalized_a === normalized_b) return 1
    
    // Levenshtein distance
    const len = Math.max(normalized_a.length, normalized_b.length)
    if (len === 0) return 1
    
    const matrix = Array(normalized_b.length + 1)
      .fill(null)
      .map(() => Array(normalized_a.length + 1).fill(0))
    
    for (let i = 0; i <= normalized_a.length; i++) matrix[0][i] = i
    for (let j = 0; j <= normalized_b.length; j++) matrix[j][0] = j
    
    for (let j = 1; j <= normalized_b.length; j++) {
      for (let i = 1; i <= normalized_a.length; i++) {
        const indicator = normalized_a[i - 1] === normalized_b[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        )
      }
    }
    
    return 1 - matrix[normalized_b.length][normalized_a.length] / len
  }

  const handleFindSimilarGenres = async () => {
    setConsolidateLoading(true)
    setSimilarGenres([])
    setConsolidateMessage('')
    setSelectedPairs(new Set())

    // Count how many books use each exact genre
    const genreCounts = new Map()
    books.forEach((book) => {
      const uniqueGenres = new Set((book.genres ?? []).map((g) => g.trim()).filter(Boolean))
      uniqueGenres.forEach((genre) => {
        genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1)
      })
    })

    // Get all unique genres from books
    const genresSet = new Map() // Map of normalized -> original
    books.forEach((book) => {
      (book.genres ?? []).forEach((g) => {
        const key = g.trim()
        if (!key) return
        const normalized = normalizeGenre(key)
        if (!genresSet.has(normalized)) {
          genresSet.set(normalized, key)
        }
      })
    })

    const genres = Array.from(genresSet.values())

    // Find similar pairs
    const pairs = []
    for (let i = 0; i < genres.length; i++) {
      for (let j = i + 1; j < genres.length; j++) {
        const similarity = stringSimilarity(genres[i], genres[j])
        if (similarity >= 0.75) {
          const genre1 = genres[i]
          const genre2 = genres[j]
          const count1 = genreCounts.get(genre1) ?? 0
          const count2 = genreCounts.get(genre2) ?? 0
          const keepGenre = count1 >= count2 ? genre1 : genre2
          const mergeGenre = keepGenre === genre1 ? genre2 : genre1
          const keepCount = keepGenre === genre1 ? count1 : count2
          const mergeCount = mergeGenre === genre1 ? count1 : count2

          pairs.push({
            keepGenre,
            mergeGenre,
            keepCount,
            mergeCount,
            similarity,
          })
        }
      }
    }

    pairs.sort((a, b) => b.similarity - a.similarity)
    setSimilarGenres(pairs)
    setConsolidateMessage(
      pairs.length ? `Found ${pairs.length} potentially similar genre pair${pairs.length > 1 ? 's' : ''}` : 'No similar genres found.'
    )
    setConsolidateLoading(false)
  }

  const handleTogglePair = (index) => {
    const newSet = new Set(selectedPairs)
    if (newSet.has(index)) {
      newSet.delete(index)
    } else {
      newSet.add(index)
    }
    setSelectedPairs(newSet)
  }

  const handleMergeGenres = async () => {
    if (selectedPairs.size === 0) {
      setConsolidateMessage('No genre pairs selected.')
      return
    }

    setMerging(true)
    const pairsToMerge = Array.from(selectedPairs).map((idx) => similarGenres[idx])

    try {
      // For each pair, update all books with mergeGenre to use keepGenre
      for (const pair of pairsToMerge) {
        // Find all books with mergeGenre
        const booksWithMergeGenre = books.filter((b) => (b.genres ?? []).includes(pair.mergeGenre))

        for (const book of booksWithMergeGenre) {
          const updatedGenres = (book.genres ?? [])
            .map((g) => (g === pair.mergeGenre ? pair.keepGenre : g))
            .filter((g, idx, arr) => arr.indexOf(g) === idx) // Remove duplicates

          const { error } = await supabase
            .from('books')
            .update({ genres: updatedGenres })
            .eq('id', book.id)

          if (error) throw error
        }
      }

      setConsolidateMessage(`Successfully merged ${pairsToMerge.length} genre pair${pairsToMerge.length > 1 ? 's' : ''}.`)
      setSimilarGenres([])
      setSelectedPairs(new Set())
      if (onRefresh) onRefresh()
    } catch (err) {
      setConsolidateMessage(err instanceof Error ? err.message : 'Failed to merge genres')
    } finally {
      setMerging(false)
    }
  }

  const handleCustomMerge = async () => {
    const fromTrimmed = customFrom.trim()
    const toTrimmed = customTo.trim()

    if (!fromTrimmed || !toTrimmed) {
      setConsolidateMessage('Please enter both genre names.')
      return
    }

    if (fromTrimmed === toTrimmed) {
      setConsolidateMessage('Source and target genres must be different.')
      return
    }

    setCustomMerging(true)
    setConsolidateMessage('')

    try {
      // Find all books with the source genre
      const booksWithSourceGenre = books.filter((b) => (b.genres ?? []).includes(fromTrimmed))

      if (booksWithSourceGenre.length === 0) {
        setConsolidateMessage(`No books found with genre "${fromTrimmed}".`)
        setCustomMerging(false)
        return
      }

      // Update all matching books
      for (const book of booksWithSourceGenre) {
        const updatedGenres = (book.genres ?? [])
          .map((g) => (g === fromTrimmed ? toTrimmed : g))
          .filter((g, idx, arr) => arr.indexOf(g) === idx) // Remove duplicates

        const { error } = await supabase
          .from('books')
          .update({ genres: updatedGenres })
          .eq('id', book.id)

        if (error) throw error
      }

      setConsolidateMessage(`Successfully merged "${fromTrimmed}" → "${toTrimmed}" (${booksWithSourceGenre.length} book${booksWithSourceGenre.length > 1 ? 's' : ''} updated).`)
      setCustomFrom('')
      setCustomTo('')
      if (onRefresh) onRefresh()
    } catch (err) {
      setConsolidateMessage(err instanceof Error ? err.message : 'Failed to merge genres')
    } finally {
      setCustomMerging(false)
    }
  }

  return (
    <section className="card quality-check-section">
      <div className="block-head quality-check-header">
        <div>
          <p className="eyebrow m-0">Quality check</p>
          <h2 className="m-0">Consolidate similar genres</h2>
          <p className="muted m-0">Find and merge genres that are variations of each other</p>
        </div>
        <button
          className="ghost quality-check-button"
          onClick={handleFindSimilarGenres}
          disabled={consolidateLoading || loading || books.length === 0}
        >
          {consolidateLoading ? 'Scanning…' : 'Find similar genres'}
        </button>
      </div>

      {consolidateMessage && <p className="muted mt-4">{consolidateMessage}</p>}

      {similarGenres.length > 0 && (
        <>
          <div className="stack duplicate-results mt-4">
            {similarGenres.map(({ keepGenre, mergeGenre, keepCount, mergeCount, similarity }, idx) => (
              <label key={`${idx}-${keepGenre}-${mergeGenre}`} className="card duplicate-item-card genre-pair-checkbox">
                <div className="genre-pair-item">
                  <input
                    type="checkbox"
                    checked={selectedPairs.has(idx)}
                    onChange={() => handleTogglePair(idx)}
                  />
                  <div className="duplicate-comparison genre-pair-content">
                    <div className="duplicate-titles-wrapper">
                      <div className="duplicate-titles-list">
                        <div className="genre-pair-names">
                          <span className="genre-name">{mergeGenre}</span>
                          <span className="genre-arrow">→</span>
                          <span className="genre-name">{keepGenre}</span>
                        </div>
                        <p className="muted text-small-muted">Merge {mergeGenre} ({mergeCount}) into {keepGenre} ({keepCount})</p>
                      </div>
                    </div>
                    <span className="pill ghost">{(similarity * 100).toFixed(0)}% match</span>
                  </div>
                </div>
              </label>
            ))}
          </div>

          {selectedPairs.size > 0 && (
            <div className="genre-merge-buttons">
              <button
                className="primary"
                onClick={handleMergeGenres}
                disabled={merging}
              >
                {merging ? 'Merging…' : `Merge ${selectedPairs.size} pair${selectedPairs.size > 1 ? 's' : ''}`}
              </button>
              <button
                className="ghost"
                onClick={() => setSelectedPairs(new Set())}
                disabled={merging}
              >
                Clear selection
              </button>
            </div>
          )}
        </>
      )}

      <div className="genre-divider">
        <h3 className="genre-divider-title">Or replace manually</h3>
        <div className="genre-custom-form">
          <div className="field">
            <label>Replace this genre:</label>
            <input
              type="text"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              autoCapitalize="words"
              style={{ textTransform: 'capitalize' }}
              placeholder="e.g. SciFi"
              disabled={customMerging}
            />
          </div>
          <div className="field">
            <label>With this genre:</label>
            <input
              type="text"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              autoCapitalize="words"
              style={{ textTransform: 'capitalize' }}
              placeholder="e.g. Science Fiction"
              disabled={customMerging}
            />
          </div>
          <button
            className="primary genre-custom-button"
            onClick={handleCustomMerge}
            disabled={customMerging || !customFrom.trim() || !customTo.trim()}
          >
            {customMerging ? 'Merging…' : 'Replace'}
          </button>
        </div>
      </div>
    </section>
  )
}

export default GenreConsolidator
