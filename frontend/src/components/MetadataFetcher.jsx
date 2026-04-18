import CoverImage from './CoverImage.jsx'

/**
 * MetadataFetcher Component
 * 
 * Handles fetching metadata from URLs with preview
 * Used in AddBook and BookDetails edit mode
 */
function MetadataFetcher({
  fetchUrl,
  onFetchUrlChange,
  onFetch,
  loading,
  error,
  success,
  fetchedMetadata,
  onApply,
  compact = false,
}) {
  return (
    <section className={`${compact ? '' : 'card'} mb-16`}>
      <p className="eyebrow">Fetch Metadata</p>
      <form onSubmit={onFetch} className="stack">
        <label className="field">
          <span>Source URL</span>
          <div className="flex gap-8">
            <input
              className="flex-1"
              type="url"
              value={fetchUrl}
              onChange={(e) => onFetchUrlChange(e.target.value)}
              placeholder="https://example.com/title-page"
              autoComplete="off"
            />
            <button
              type="submit"
              className={compact ? 'ghost' : 'primary'}
              disabled={loading}
            >
              {loading ? 'Fetching…' : 'Fetch'}
            </button>
          </div>
        </label>
        {error && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}
      </form>

      {fetchedMetadata && (
          <div className="metadata-preview">
            <CoverImage className="thumb" src={fetchedMetadata.image} title={fetchedMetadata.title} />
          <div className="stack">
            <strong>{fetchedMetadata.title}</strong>
            <p className="muted m-0">
              {fetchedMetadata.description}
            </p>
            {fetchedMetadata.genres?.length > 0 && (
              <div className="pill-row mt-8">
                {fetchedMetadata.genres.map((g, i) => (
                  <span key={`${g}-${i}`} className="pill ghost">
                    {g}
                  </span>
                ))}
              </div>
            )}
            <div className="pill-row mt-4">
              {fetchedMetadata.latest_chapter && (
                <span className="pill ghost">Latest: {fetchedMetadata.latest_chapter}</span>
              )}
              {fetchedMetadata.chapter_count !== null && fetchedMetadata.chapter_count !== undefined && (
                <span className="pill ghost">Chapters: {fetchedMetadata.chapter_count}</span>
              )}
            </div>
            <div className="flex gap-8 mt-8">
              <button className="ghost" onClick={onApply}>
                Apply to fields
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default MetadataFetcher
