interface Props {
  onClick: () => void
  /** Inherits the surrounding text colour, so it reads on a team-coloured banner. */
  tone?: 'inherit' | 'muted'
}

/** Opens the methodology. Sits top right on both the picker and the banner. */
export function AboutButton({ onClick, tone = 'inherit' }: Props) {
  return (
    <button
      onClick={onClick}
      aria-label="About this tool and its methodology"
      title="About this tool"
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-current focus-visible:outline-none ${
        tone === 'muted'
          ? 'text-stone-400 hover:text-stone-900'
          : 'opacity-80 hover:opacity-100'
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M9.6 9.2a2.5 2.5 0 1 1 3.2 2.6c-.6.2-.9.7-.9 1.3v.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx="11.9" cy="16.6" r="1" fill="currentColor" />
      </svg>
    </button>
  )
}
