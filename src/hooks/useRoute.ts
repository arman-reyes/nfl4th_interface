import { useCallback, useEffect, useState } from 'react'
import { pathFor, viewAt } from '../lib/routes'
import type { ViewName } from '../lib/routes'

/**
 * The address bar as state: pushState on navigation, popstate on back.
 *
 * Only the top-level view lives in the URL. Which team is selected, and every
 * control on the garbage-time page, stay in component state — they are a
 * session rather than a place, and putting them in history would make the back
 * button step through slider positions instead of leaving the page.
 */
export function useRoute(): [ViewName, (next: ViewName) => void] {
  const [view, setView] = useState<ViewName>(() => viewAt(window.location.pathname))

  useEffect(() => {
    const onPop = () => setView(viewAt(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((next: ViewName) => {
    setView((current) => {
      if (current === next) return current
      window.history.pushState(null, '', pathFor(next))
      window.scrollTo(0, 0)
      return next
    })
  }, [])

  return [view, navigate]
}
