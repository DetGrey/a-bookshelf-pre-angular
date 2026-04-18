export const mockBooks = [
  {
    id: '1',
    title: 'Test Book 1',
    description: 'A test book description',
    cover_url: 'https://example.com/cover1.jpg',
    status: 'reading',
    original_language: 'English',
    last_read: '2024-01-01',
    latest_chapter: 'Ch. 5',
    genres: ['Fantasy', 'Adventure'],
    shelves: [],
    sources: [{ url: 'https://example.com', label: 'Read' }],
  },
  {
    id: '2',
    title: 'Test Book 2',
    description: 'Another test description',
    cover_url: 'https://example.com/cover2.jpg',
    status: 'waiting',
    original_language: 'English',
    last_read: null,
    latest_chapter: 'Ch. 10',
    genres: ['Mystery'],
    shelves: [],
    sources: [{ url: 'https://example.com', label: 'Read' }],
  },
]

export const STATUS = {
  reading: 'Reading',
  completed: 'Completed',
  plan_to_read: 'Plan to Read',
  waiting: 'Waiting',
  dropped: 'Dropped',
  on_hold: 'On Hold',
}

export const truncateText = (text, maxWords = 15) => {
  if (!text) return ''
  const words = text.split(' ')
  if (words.length > maxWords) {
    return words.slice(0, maxWords).join(' ') + '...'
  }
  return text
}
