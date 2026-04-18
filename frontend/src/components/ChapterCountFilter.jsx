/**
 * ChapterCountFilter Component
 * 
 * Filter books by chapter count with predefined ranges
 * Supports min/max filtering
 */
function ChapterCountFilter({ 
  chapterFilter, 
  onChapterFilterChange, 
  isOpen, 
  onOpenChange 
}) {
  const presetOptions = [
    { value: 10, label: '10 chapters' },
    { value: 20, label: '20 chapters' },
    { value: 50, label: '50 chapters' },
    { value: 100, label: '100 chapters' },
    { value: 200, label: '200 chapters' },
  ]

  const handlePresetClick = (value) => {
    if (chapterFilter.value === value) {
      // Toggle off if already selected
      onChapterFilterChange({ mode: 'all', value: null })
    } else {
      // Set new value, keep existing mode or default to 'max'
      onChapterFilterChange({ 
        mode: chapterFilter.mode || 'max', 
        value 
      })
    }
  }

  const handleModeChange = (newMode) => {
    if (chapterFilter.value !== null) {
      onChapterFilterChange({ mode: newMode, value: chapterFilter.value })
    }
  }

  const handleClear = () => {
    onChapterFilterChange({ mode: 'all', value: null })
    onOpenChange(false)
  }

  const activeCount = chapterFilter.value !== null ? 1 : 0

  return (
    <div className="block mt-12">
      <div
        className="flex justify-between items-center mb-8 cursor-pointer"
        onClick={() => onOpenChange(!isOpen)}
      >
        <p className="eyebrow m-0">
          Filter by Chapter Count {isOpen ? '▼' : '▶'}
        </p>
        {chapterFilter.value !== null && (
          <div className="flex gap-4">
            <button
              className={`${chapterFilter.mode === 'max' ? 'pill' : 'pill ghost'} filter-toggle-button`}
              onClick={(e) => {
                e.stopPropagation()
                handleModeChange('max')
              }}
            >
              Max
            </button>
            <button
              className={`${chapterFilter.mode === 'min' ? 'pill' : 'pill ghost'} filter-toggle-button`}
              onClick={(e) => {
                e.stopPropagation()
                handleModeChange('min')
              }}
            >
              Min
            </button>
          </div>
        )}
      </div>
      {isOpen && (
        <div className="flex items-center gap-4 flex-wrap">
          {activeCount > 0 && (
            <button
              className="pill radius-8 cursor-pointer"
              onClick={handleClear}
            >
              ✕ Clear
            </button>
          )}
          {presetOptions.map((option) => {
            const isActive = chapterFilter.value === option.value
            return (
              <button
                key={option.value}
                className={`${isActive ? 'pill' : 'pill ghost'} radius-8 cursor-pointer`}
                onClick={() => handlePresetClick(option.value)}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ChapterCountFilter
