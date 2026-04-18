import { useState } from 'react'

/**
 * ShelfSidebar Component
 * 
 * Left sidebar for the Bookshelf page displaying:
 * - Status-based shelves with book counts
 * - Custom user shelves with delete capability
 * - Form to create new shelves
 */
function ShelfSidebar({
  statusShelves,
  customShelves,
  activeShelf,
  onShelfChange,
  onDeleteShelf,
  onCreateShelf,
  getShelfCount,
}) {
  const [showNewShelfForm, setShowNewShelfForm] = useState(false)
  const [newShelfName, setNewShelfName] = useState('')
  const [statusOpen, setStatusOpen] = useState(true)
  const [customOpen, setCustomOpen] = useState(true)

  const handleCreateShelf = async (e) => {
    e.preventDefault()
    if (newShelfName.trim()) {
      await onCreateShelf(newShelfName.trim())
      setNewShelfName('')
      setShowNewShelfForm(false)
    }
  }

  return (
    <aside className="shelf-sidebar">
      {/* Status shelves */}
      <div className="block">
        <div className="block-head cursor-pointer" onClick={() => setStatusOpen(!statusOpen)}>
          <p className="eyebrow">Status {statusOpen ? '▼' : '▶'}</p>
        </div>
        {statusOpen && <nav className="shelf-list">
          {statusShelves.map((shelf) => {
            const count = getShelfCount(shelf.id)
            return (
              <button
                key={shelf.id}
                className={`shelf-item ${activeShelf === shelf.id ? 'active' : ''}`}
                onClick={() => onShelfChange(shelf.id)}
              >
                <div>
                  <span>{shelf.name}</span>
                  <span className="shelf-count">{count}</span>
                </div>
              </button>
            )
          })}
        </nav>}
      </div>

      {/* Custom shelves */}
      <div className="block shelf-block-section">
        <div className="block-head cursor-pointer" onClick={() => setCustomOpen(!customOpen)}>
          <p className="eyebrow">Custom Shelves {customOpen ? '▼' : '▶'}</p>
          <button
            className="ghost shelf-header-button"
            onClick={(e) => {
              e.stopPropagation()
              setShowNewShelfForm(!showNewShelfForm)
            }}
          >
            + New
          </button>
        </div>
        {customOpen && <nav className="shelf-list">
          {customShelves.map((shelf) => {
            const count = getShelfCount(shelf.id)
            return (
              <div key={shelf.id} className="shelf-item-wrapper">
                <button
                  className={`shelf-item flex-1 ${activeShelf === shelf.id ? 'active' : ''}`}
                  onClick={() => onShelfChange(shelf.id)}
                >
                  <div>
                    <span>{shelf.name}</span>
                    <span className="shelf-count">{count}</span>
                  </div>
                </button>
                <button
                  className="shelf-delete"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteShelf(shelf.id)
                  }}
                >
                  ×
                </button>
              </div>
            )
          })}
        </nav>}

        {customOpen && showNewShelfForm && (
          <form className="stack" onSubmit={handleCreateShelf}>
            <label className="field">
              <span>Shelf name</span>
              <input
                type="text"
                value={newShelfName}
                onChange={(e) => setNewShelfName(e.target.value)}
                placeholder="Favorites, To Buy..."
                autoFocus
              />
            </label>
            <div className="shelf-form-section">
              <button type="submit" className="primary shelf-form-button">
                Create
              </button>
              <button
                type="button"
                className="ghost shelf-form-button"
                onClick={() => setShowNewShelfForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </aside>
  )
}

export default ShelfSidebar
