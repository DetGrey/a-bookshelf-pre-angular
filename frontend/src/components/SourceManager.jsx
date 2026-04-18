import { useState } from 'react'

/**
 * SourceManager Component
 * 
 * Manages book source/link display and editing
 * Used in AddBook and BookDetails
 */
function SourceManager({
  sources,
  onRemoveSource,
  newSourceLabel,
  onSourceLabelChange,
  newSourceUrl,
  onSourceUrlChange,
  onAddSource,
  isEditing = false,
}) {
  const [isCollapsed, setIsCollapsed] = useState(isEditing)

  if (!isEditing && sources.length === 0) {
    return null
  }

  return (
    <section className="card">
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`ghost collapsible-header ${!isCollapsed ? 'expanded' : ''}`}
      >
        <p className="eyebrow">Source Links</p>
        <span className="collapsible-arrow">{isCollapsed ? '▶' : '▼'}</span>
      </button>

      {!isCollapsed && (
        <>
          {sources.length > 0 && (
            <div className="source-grid">
              {sources.map((source, index) =>
                isEditing ? (
                  <div key={index} className="source-card">
                    <div>
                      <strong>{source.label}</strong>
                      <p className="muted text-small word-break-all">
                        {source.url}
                      </p>
                    </div>
                    <button
                      className="ghost text-danger"
                      onClick={() => onRemoveSource(index)}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <a
                    key={index}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="source-card"
                  >
                    <div>
                      <strong>{source.label}</strong>
                      <p className="muted text-small">
                        Open in new tab →
                      </p>
                    </div>
                  </a>
                )
              )}
            </div>
          )}

          {isEditing && (
            <form className="stack mt-8" onSubmit={onAddSource}>
              <p className="eyebrow">Add New Source</p>
              <div className="grid-2">
                <label className="field">
                  <span>Label</span>
                  <input
                    type="text"
                    value={newSourceLabel}
                    onChange={(e) => onSourceLabelChange(e.target.value)}
                    placeholder="Official, Scanlation A..."
                  />
                </label>
                <label className="field">
                  <span>URL</span>
                  <input
                    type="url"
                    value={newSourceUrl}
                    onChange={(e) => onSourceUrlChange(e.target.value)}
                    placeholder="https://..."
                  />
                </label>
              </div>
              <button type="submit" className="ghost">
                + Add Source
              </button>
            </form>
          )}
        </>
      )}
    </section>
  )
}

export default SourceManager
