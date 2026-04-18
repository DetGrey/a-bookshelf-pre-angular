import { Link } from 'react-router-dom'
import BookCard from './BookCard.jsx'

/**
 * BookGrid Component
 * 
 * Displays a grid of books or an empty state
 * Handles loading, empty, and error states
 */
function BookGrid({
  books,
  loading,
  customShelves = [],
  onAddToShelf,
  activeGenres = [],
  setActiveGenres,
  compact = false,
  emptyStateText = "No books match your filters.",
  showAddButton = true,
  onOpenBook,
}) {
  if (loading) {
    return (
      <div className="centered">
        <p className="muted">Loading books...</p>
      </div>
    )
  }

  if (books.length === 0) {
    return (
      <div className="centered">
        <p className="muted">{emptyStateText}</p>
        {showAddButton && (
          <Link to="/add" className="primary">
            Add your first book
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="card-grid">
      {books.map((book) => (
        <BookCard
          key={book.id}
          book={book}
          onAddToShelf={onAddToShelf}
          customShelves={customShelves}
          activeGenres={activeGenres}
          setActiveGenres={setActiveGenres}
          compact={compact}
          onOpenBook={onOpenBook}
        />
      ))}
    </div>
  )
}

export default BookGrid
