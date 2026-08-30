import { useEffect, useState } from 'react'

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: Error | null
}

interface Settled<T> {
  key: string
  data: T | null
  error: Error | null
}

/**
 * Runs `load` whenever `key` changes and holds the result.
 *
 * The settled result carries the key it belongs to, so a response that lands
 * after the selection has moved on is simply not the current key and never
 * renders. `key` of null means there is nothing to load and nothing is
 * fetched.
 */
export function useAsync<T>(key: string | null, load: (key: string) => Promise<T>): AsyncState<T> {
  const [settled, setSettled] = useState<Settled<T> | null>(null)

  useEffect(() => {
    if (key === null) return
    let live = true
    load(key).then(
      (data) => {
        if (live) setSettled({ key, data, error: null })
      },
      (error: unknown) => {
        if (live) {
          setSettled({
            key,
            data: null,
            error: error instanceof Error ? error : new Error(String(error)),
          })
        }
      },
    )
    return () => {
      live = false
    }
  }, [key, load])

  const current = settled !== null && settled.key === key ? settled : null
  return {
    data: current?.data ?? null,
    loading: key !== null && current === null,
    error: current?.error ?? null,
  }
}
