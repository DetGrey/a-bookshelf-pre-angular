import { useState } from 'react'

/**
 * GenreFilter Component
 * 
 * Displays genre filter pills with toggle and filter mode (any/all)
 * Used in Bookshelf to filter by genres
 */
function GenreFilter({
  allGenres,
  activeGenres,
  onGenreChange,
  genreFilterMode,
  onGenreFilterModeChange,
  isOpen = false,
  onOpenChange,
}) {
  const [isOpenLocal, setIsOpenLocal] = useState(isOpen)
  
  const isControlled = onOpenChange !== undefined
  const open = isControlled ? isOpen : isOpenLocal
  const setOpen = isControlled ? onOpenChange : setIsOpenLocal
  
  if (allGenres.length === 0) {
    return null
  }

  return (
    <div className="block mt-12">
      <div
        className="flex justify-between items-center mb-8 cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <p className="eyebrow m-0">
          Filter by Genre {open ? '▼' : '▶'}
        </p>
        {activeGenres.length > 0 && (
          <div className="flex gap-4">
            <button
              className={`${genreFilterMode === 'any' ? 'pill' : 'pill ghost'} filter-toggle-button`}
              onClick={() => onGenreFilterModeChange('any')}
            >
              Any
            </button>
            <button
              className={`${genreFilterMode === 'all' ? 'pill' : 'pill ghost'} filter-toggle-button`}
              onClick={() => onGenreFilterModeChange('all')}
            >
              All
            </button>
          </div>
        )}
      </div>
      {open && <div className="flex items-center gap-4 flex-wrap">
        {activeGenres.length > 0 && (
          <button
            className="pill radius-8 cursor-pointer"
            onClick={() => {
              onGenreChange([])
              setOpen(false)
            }}
          >
            ✕ Clear
          </button>
        )}
        {allGenres.map((genre) => {
          const isActive = activeGenres.includes(genre)
          return (
            <button
              key={genre}
              className={`${isActive ? 'pill' : 'pill ghost'} radius-8 cursor-pointer`}
              onClick={() => {
                onGenreChange(
                  isActive ? activeGenres.filter((g) => g !== genre) : [...activeGenres, genre]
                )
              }}
            >
              {genre}
            </button>
          )
        })}
      </div>}
    </div>
  )
}

export default GenreFilter
