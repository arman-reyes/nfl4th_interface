import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

/**
 * The rendered width of an element, so a chart can be drawn at real pixel
 * sizes rather than scaled through a viewBox — which would stretch its labels
 * along with everything else.
 *
 * ResizeObserver fires once on observe, which covers the first measurement
 * without a synchronous setState inside the effect.
 */
export function useElementWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width
      if (measured !== undefined) setWidth(measured)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return [ref, width]
}
