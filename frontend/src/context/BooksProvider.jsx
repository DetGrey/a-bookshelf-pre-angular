/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from './AuthProvider.jsx'
import { getBooks, getShelves } from '../lib/db.js'
import { supabase } from '../lib/supabaseClient.js'

const BooksContext = createContext(null)

// Cache validity in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000

export function BooksProvider({ children }) {
  const { user } = useAuth()
  const [books, setBooks] = useState([])
  const [shelves, setShelves] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const cacheRef = useRef({ books: null, shelves: null, timestamp: 0 })
  const subscriptionRef = useRef(null)

  // Fetch books and shelves from Supabase
  const fetchBooksAndShelves = useCallback(async (forceRefresh = false) => {
    if (!user) return

    // Check cache validity (skip if force refresh)
    const now = Date.now()
    if (
      !forceRefresh &&
      cacheRef.current.books &&
      cacheRef.current.shelves &&
      now - cacheRef.current.timestamp < CACHE_TTL
    ) {
      setBooks(cacheRef.current.books)
      setShelves(cacheRef.current.shelves)
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      const [list, shelfList] = await Promise.all([
        getBooks(user.id),
        getShelves(user.id),
      ])
      cacheRef.current = {
        books: list,
        shelves: shelfList,
        timestamp: Date.now(),
      }
      setBooks(list)
      setShelves(shelfList)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  // Subscribe to realtime changes on books table
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`books-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'books',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Invalidate cache and refetch on any change
          cacheRef.current.timestamp = 0
          fetchBooksAndShelves(true)
        }
      )
      .subscribe()

    subscriptionRef.current = channel

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current)
      }
    }
  }, [user, fetchBooksAndShelves])

  // Subscribe to realtime changes on shelves
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`shelves-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shelves',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Invalidate cache and refetch on any change
          cacheRef.current.timestamp = 0
          fetchBooksAndShelves(true)
        }
      )
      .subscribe()

    subscriptionRef.current = channel

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current)
      }
    }
  }, [user, fetchBooksAndShelves])

  // Fetch on user change
  useEffect(() => {
    if (user) {
      fetchBooksAndShelves(true)
    } else {
      setBooks([])
      setShelves([])
      cacheRef.current = { books: null, shelves: null, timestamp: 0 }
    }
  }, [user, fetchBooksAndShelves])

  return (
    <BooksContext.Provider
      value={{
        books,
        shelves,
        loading,
        error,
        setBooks,
        refetch: () => fetchBooksAndShelves(true),
        updateCache: () => fetchBooksAndShelves(false),
      }}
    >
      {children}
    </BooksContext.Provider>
  )
}

function useBooks() {
  const context = useContext(BooksContext)
  if (!context) {
    throw new Error('useBooks must be used within BooksProvider')
  }
  return context
}

export default BooksProvider
export { useBooks }

