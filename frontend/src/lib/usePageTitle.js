import { useEffect } from 'react'

const APP_NAME = 'A Bookshelf'

/**
 * Update document title with a page-specific prefix.
 */
export function usePageTitle(title) {
  useEffect(() => {
    if (!title) return
    document.title = `${title} · ${APP_NAME}`
  }, [title])
}
