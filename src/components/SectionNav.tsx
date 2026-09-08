import { useEffect, useId, useRef, useState } from 'react'
import { SECTIONS, sectionOf } from '../lib/routes'
import type { ViewName } from '../lib/routes'

interface Props {
  current: ViewName
  onNavigate: (view: ViewName) => void
}

/**
 * The page's title, and the way between pages.
 *
 * Each statistical display owns a heading, and the heading is the switcher —
 * so moving from 4th downs to garbage time is the same gesture as reading which
 * one you are on. A row of buttons in the corner would need a new button per
 * page and would say nothing about what any of them are; a menu hung off the
 * title grows by one line in `SECTIONS` and has room to say what each page
 * answers.
 *
 * The h1 wraps the button rather than the other way round: a button may only
 * contain phrasing content, so a heading inside one is invalid.
 */
export function SectionNav({ current, onNavigate }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const section = sectionOf(current)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      // Escape should leave focus where the reader left it, not on the body.
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function choose(view: ViewName) {
    setOpen(false)
    if (view !== current) onNavigate(view)
  }

  return (
    <div ref={rootRef} className="relative">
      <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
        <button
          ref={triggerRef}
          onClick={() => setOpen((was) => !was)}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-controls={open ? menuId : undefined}
          className="group -mx-1 flex items-center gap-1.5 rounded px-1 hover:text-stone-700 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {section.title}
          <svg
            aria-hidden
            viewBox="0 0 10 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-2 w-3.5 shrink-0 text-stone-400 transition-transform group-hover:text-stone-600 ${
              open ? 'rotate-180' : ''
            }`}
          >
            <path d="M1 1l4 4 4-4" />
          </svg>
        </button>
      </h1>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Statistical displays"
          className="absolute top-full left-0 z-30 mt-2 w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg"
        >
          {SECTIONS.map((entry) => {
            const isCurrent = entry.view === current
            return (
              <button
                key={entry.view}
                role="menuitem"
                aria-current={isCurrent ? 'page' : undefined}
                onClick={() => choose(entry.view)}
                className={`flex w-full items-start gap-2.5 border-b border-stone-100 px-3.5 py-3 text-left last:border-b-0 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:-outline-offset-2 focus-visible:outline-none ${
                  isCurrent ? 'bg-stone-50' : 'hover:bg-stone-50'
                }`}
              >
                <span
                  aria-hidden
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                    isCurrent ? 'bg-amber-600' : 'bg-transparent'
                  }`}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-bold tracking-tight text-stone-900">
                    {entry.title}
                    {isCurrent && (
                      <span className="ml-1.5 text-[0.625rem] font-semibold tracking-wide text-stone-400 uppercase">
                        Viewing
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[0.6875rem] leading-snug text-stone-500">
                    {entry.blurb}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
