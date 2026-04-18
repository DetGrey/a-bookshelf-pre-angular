import { supabase } from './supabaseClient.js'

const LANGUAGE_NAME_MAP = {
  en: 'English', enus: 'English', eng: 'English',
  es: 'Spanish', esp: 'Spanish', spa: 'Spanish',
  ja: 'Japanese', jp: 'Japanese', jpn: 'Japanese',
  ko: 'Korean', kr: 'Korean', kor: 'Korean',
  zh: 'Chinese', chi: 'Chinese', cn: 'Chinese', zhtw: 'Chinese', zhcn: 'Chinese',
  fr: 'French', fra: 'French', fre: 'French',
  de: 'German', deu: 'German', ger: 'German',
  it: 'Italian', ita: 'Italian',
  pt: 'Portuguese', prt: 'Portuguese', ptbr: 'Portuguese',
  ru: 'Russian', rus: 'Russian',
  vi: 'Vietnamese', vie: 'Vietnamese',
  id: 'Indonesian', ind: 'Indonesian',
  th: 'Thai', tha: 'Thai',
}

const normalizeLanguageName = (value) => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const key = trimmed.toLowerCase().replace(/[_-]/g, '')
  if (LANGUAGE_NAME_MAP[key]) return LANGUAGE_NAME_MAP[key]
  if (/^[a-z]{2,3}$/.test(key)) return null // prefer empty over surfacing codes
  return trimmed
}

const normalizeTimesRead = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.round(n)
}

// Helpers for status mapping (DB uses lowercase snake_case)
export const STATUS = {
  reading: 'Reading',
  plan_to_read: 'Plan to Read',
  waiting: 'Waiting',
  completed: 'Completed',
  dropped: 'Dropped',
  on_hold: 'On Hold',
}
export const STATUS_KEYS = Object.keys(STATUS)

export const SCORE_OPTIONS = [
  { value: 10, label: '10 — Masterpiece' },
  { value: 9, label: '9 — Great' },
  { value: 8, label: '8 — Pretty Good' },
  { value: 7, label: '7 — Good' },
  { value: 6, label: '6 — Fine' },
  { value: 5, label: '5 — Average' },
  { value: 4, label: '4 — Bad' },
  { value: 3, label: '3 — Pretty Bad' },
  { value: 2, label: '2 — Horrible' },
  { value: 1, label: '1 — Appalling' },
  { value: 0, label: '0 — N/A' },
]

export function scoreToLabel(score) {
  if (score === null || score === undefined) return null
  const option = SCORE_OPTIONS.find((o) => o.value === Number(score))
  return option ? option.label : null
}

// Helper to truncate text to first N words
export function truncateText(text, maxWords = 15) {
  if (!text) return ''
  const words = text.trim().split(/\s+/)
  if (words.length > maxWords) {
    return words.slice(0, maxWords).join(' ') + '...'
  }
  return text
}

export async function getBooks(userId) {
  const { data, error } = await supabase
    .from('books')
    .select(
      'id,user_id,title,description,cover_url,genres,language,original_language,score,status,last_read,notes,latest_chapter,last_fetched_at,last_uploaded_at,times_read,chapter_count,created_at,updated_at,book_links(id,site_name,url,created_at),shelf_books(shelf_id)'
    )
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((b) => ({
    id: b.id,
    user_id: b.user_id,
    title: b.title,
    description: b.description ?? '',
    cover_url: b.cover_url ?? '',
    genres: b.genres ?? [],
    language: normalizeLanguageName(b.language),
    original_language: normalizeLanguageName(b.original_language),
    score: b.score ?? null,
    status: b.status, // lowercase key
    last_read: b.last_read ?? '',
    notes: b.notes ?? '',
    latest_chapter: b.latest_chapter ?? '',
    last_fetched_at: b.last_fetched_at ?? null,
    last_uploaded_at: b.last_uploaded_at ?? null,
    times_read: b.times_read ?? 1,
    chapter_count: b.chapter_count ?? null,
    created_at: b.created_at,
    updated_at: b.updated_at,
    sources: (b.book_links ?? []).map((l) => ({ id: l.id, label: l.site_name ?? 'Source', url: l.url })),
    shelves: (b.shelf_books ?? []).map((s) => s.shelf_id),
  }))
}

export async function getBook(bookId) {
  const { data, error } = await supabase
    .from('books')
    .select(
      'id,user_id,title,description,cover_url,genres,language,original_language,score,status,last_read,notes,latest_chapter,last_fetched_at,last_uploaded_at,times_read,chapter_count,created_at,updated_at,book_links(id,site_name,url,created_at),shelf_books(shelf_id)'
    )
    .eq('id', bookId)
    .single()
  if (error) throw error
  return {
    id: data.id,
    user_id: data.user_id,
    title: data.title,
    description: data.description ?? '',
    cover_url: data.cover_url ?? '',
    genres: data.genres ?? [],
    language: normalizeLanguageName(data.language),
    original_language: normalizeLanguageName(data.original_language),
    score: data.score ?? null,
    status: data.status,
    last_read: data.last_read ?? '',
    notes: data.notes ?? '',
    latest_chapter: data.latest_chapter ?? '',
    last_fetched_at: data.last_fetched_at ?? null,
    last_uploaded_at: data.last_uploaded_at ?? null,
    times_read: data.times_read ?? 1,
    chapter_count: data.chapter_count ?? null,
    created_at: data.created_at,
    updated_at: data.updated_at,
    sources: (data.book_links ?? []).map((l) => ({ id: l.id, label: l.site_name ?? 'Source', url: l.url })),
    shelves: (data.shelf_books ?? []).map((s) => s.shelf_id),
  }
}

export async function updateBook(bookId, patch) {
  const timesRead = normalizeTimesRead(patch.times_read)
  const payload = {
    title: patch.title,
    description: patch.description,
    cover_url: patch.cover_url,
    genres: patch.genres,
    language: normalizeLanguageName(patch.language),
    original_language: normalizeLanguageName(patch.original_language),
    score: patch.score,
    status: patch.status, // expect lowercase key
    last_read: patch.last_read,
    notes: patch.notes,
    latest_chapter: patch.latest_chapter,
    last_fetched_at: patch.last_fetched_at,
    last_uploaded_at: patch.last_uploaded_at,
    times_read: timesRead,
    chapter_count: patch.chapter_count,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('books').update(payload).eq('id', bookId)
  if (error) throw error
}

export async function createBook(userId, book) {
  const timesRead = normalizeTimesRead(book.times_read)
  const payload = {
    user_id: userId,
    title: book.title,
    description: book.description ?? '',
    cover_url: book.cover_url ?? book.image ?? '',
    genres: book.genres ?? [],
    language: normalizeLanguageName(book.language),
    original_language: normalizeLanguageName(book.original_language),
    score: book.score ?? null,
    status: book.status ?? 'reading',
    last_read: book.last_read ?? '',
    notes: book.notes ?? '',
    latest_chapter: book.latest_chapter ?? '',
    last_fetched_at: book.last_fetched_at ?? null,
    last_uploaded_at: book.last_uploaded_at ?? null,
    times_read: timesRead,
    chapter_count: book.chapter_count ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase.from('books').insert(payload).select('id').single()
  if (error) throw error
  return data?.id
}

export async function deleteBook(bookId) {
  const { error } = await supabase.from('books').delete().eq('id', bookId)
  if (error) throw error
}

export async function addLink(bookId, siteName, url) {
  const { error } = await supabase.from('book_links').insert({ book_id: bookId, site_name: siteName, url })
  if (error) throw error
}

export async function deleteLink(linkId) {
  const { error } = await supabase.from('book_links').delete().eq('id', linkId)
  if (error) throw error
}

// Export all user-owned rows for backup (JSON download)
export async function getBackup(userId) {
  // Base tables scoped by user_id
  const booksRes = await supabase.from('books').select('*').eq('user_id', userId)
  if (booksRes.error) throw booksRes.error

  const shelvesRes = await supabase.from('shelves').select('*').eq('user_id', userId)
  if (shelvesRes.error) throw shelvesRes.error

  // Dependent tables filtered by owned ids (book_links, shelf_books may not have user_id columns)
  const bookIds = (booksRes.data ?? []).map((b) => b.id)
  const shelfIds = (shelvesRes.data ?? []).map((s) => s.id)

  let bookLinks = []
  if (bookIds.length > 0) {
    const bookLinksRes = await supabase.from('book_links').select('*').in('book_id', bookIds)
    if (bookLinksRes.error) throw bookLinksRes.error
    bookLinks = bookLinksRes.data ?? []
  }

  let shelfBooks = []
  if (shelfIds.length > 0) {
    const shelfBooksRes = await supabase.from('shelf_books').select('*').in('shelf_id', shelfIds)
    if (shelfBooksRes.error) throw shelfBooksRes.error
    shelfBooks = shelfBooksRes.data ?? []
  }

  const profileRes = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (profileRes.error) throw profileRes.error

  return {
    exported_at: new Date().toISOString(),
    user_id: userId,
    profiles: profileRes.data ? [profileRes.data] : [],
    books: booksRes.data ?? [],
    shelves: shelvesRes.data ?? [],
    shelf_books: shelfBooks,
    book_links: bookLinks,
  }
}

// Restore backup JSON (upsert) scoped to the signed-in user
export async function restoreBackup(userId, backup) {
  if (!backup || typeof backup !== 'object') throw new Error('Invalid backup payload')

  const books = (backup.books ?? []).map((b) => ({ ...b, user_id: userId }))
  const shelves = (backup.shelves ?? []).map((s) => ({ ...s, user_id: userId }))
  const bookLinks = backup.book_links ?? []
  const shelfBooks = backup.shelf_books ?? []
  const profileRow = backup.profiles?.[0]

  const chunk = (arr, size = 500) => {
    const out = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
  }

  const upsertChunks = async (table, rows, options) => {
    for (const part of chunk(rows)) {
      const { error } = await supabase.from(table).upsert(part, options)
      if (error) throw error
    }
  }

  if (profileRow) {
    const profilePayload = { ...profileRow, id: userId }
    const { error } = await supabase.from('profiles').upsert(profilePayload)
    if (error) throw error
  }

  if (shelves.length) await upsertChunks('shelves', shelves, { onConflict: 'id' })
  if (books.length) await upsertChunks('books', books, { onConflict: 'id' })
  if (bookLinks.length) await upsertChunks('book_links', bookLinks)
  if (shelfBooks.length) await upsertChunks('shelf_books', shelfBooks)

  return true
}

export async function getShelves(userId) {
  const { data, error } = await supabase
    .from('shelves')
    .select('id,name,created_at')
    .eq('user_id', userId)
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createShelf(userId, name) {
  const { data, error } = await supabase
    .from('shelves')
    .insert({ user_id: userId, name })
    .select('id,name,created_at')
    .single()
  if (error) throw error
  return data
}

export async function deleteShelf(shelfId) {
  const { error } = await supabase.from('shelves').delete().eq('id', shelfId)
  if (error) throw error
}

export async function getBookShelvesForBooks(bookIds) {
  if (!bookIds?.length) return []
  const { data, error } = await supabase
    .from('shelf_books')
    .select('book_id,shelf_id')
    .in('book_id', bookIds)
  if (error) throw error
  return data ?? []
}

export async function toggleBookShelf(bookId, shelfId) {
  const { data, error } = await supabase
    .from('shelf_books')
    .select('book_id,shelf_id')
    .eq('book_id', bookId)
    .eq('shelf_id', shelfId)
    .maybeSingle()
  if (error) throw error
  if (data) {
    const { error: delErr } = await supabase
      .from('shelf_books')
      .delete()
      .eq('book_id', bookId)
      .eq('shelf_id', shelfId)
    if (delErr) throw delErr
    return { added: false }
  }
  const { error: insErr } = await supabase.from('shelf_books').insert({ book_id: bookId, shelf_id: shelfId })
  if (insErr) throw insErr
  return { added: true }
}

// Related Books (for linking books like language versions)
export async function getRelatedBooks(bookId) {
  // Get forward relations (this book -> other books)
  const { data: forward, error: forwardError } = await supabase
    .from('related_books')
    .select('id,related_book_id,relationship_type,created_at,books!related_books_related_book_id_fkey(id,title,language,cover_url,status)')
    .eq('book_id', bookId)
  if (forwardError) throw forwardError

  // Get reverse relations (other books -> this book)
  const { data: reverse, error: reverseError } = await supabase
    .from('related_books')
    .select('id,book_id,relationship_type,created_at,books!related_books_book_id_fkey(id,title,language,cover_url,status)')
    .eq('related_book_id', bookId)
  if (reverseError) throw reverseError

  const forwardMapped = (forward ?? []).map((r) => ({
    id: r.id,
    relatedBookId: r.related_book_id,
    relationshipType: r.relationship_type,
    createdAt: r.created_at,
    isReverse: false,
    book: r.books ? {
      id: r.books.id,
      title: r.books.title,
      language: normalizeLanguageName(r.books.language),
      coverUrl: r.books.cover_url ?? '',
      status: r.books.status,
    } : null,
  }))

  const reverseMapped = (reverse ?? []).map((r) => ({
    id: r.id,
    relatedBookId: r.book_id,
    relationshipType: r.relationship_type,
    createdAt: r.created_at,
    isReverse: true,
    book: r.books ? {
      id: r.books.id,
      title: r.books.title,
      language: normalizeLanguageName(r.books.language),
      coverUrl: r.books.cover_url ?? '',
      status: r.books.status,
    } : null,
  }))

  return [...forwardMapped, ...reverseMapped]
}

export async function addRelatedBook(bookId, relatedBookId, relationshipType = 'related') {
  const { error } = await supabase
    .from('related_books')
    .insert({ book_id: bookId, related_book_id: relatedBookId, relationship_type: relationshipType })
  if (error) throw error
}

export async function deleteRelatedBook(relatedBookId) {
  const { error } = await supabase.from('related_books').delete().eq('id', relatedBookId)
  if (error) throw error
}

export async function searchBooks(userId, query) {
  if (!query || query.trim().length < 2) return []
  const searchTerm = `%${query.trim()}%`
  const { data, error } = await supabase
    .from('books')
    .select('id,title,language,cover_url,status')
    .eq('user_id', userId)
    .ilike('title', searchTerm)
    .order('title', { ascending: true })
    .limit(10)
  if (error) throw error
  return (data ?? []).map((b) => ({
    id: b.id,
    title: b.title,
    language: normalizeLanguageName(b.language),
    coverUrl: b.cover_url ?? '',
    status: b.status,
  }))
}