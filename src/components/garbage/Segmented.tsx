interface Props<T extends string> {
  options: { value: T; label: string }[]
  value: T
  label: string
  onChange: (next: T) => void
}

const BUTTON =
  'px-3 py-1.5 text-xs font-semibold tracking-wide uppercase transition-colors focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 focus-visible:outline-none'

/** A row of mutually exclusive choices, styled as one control. */
export function Segmented<T extends string>({ options, value, label, onChange }: Props<T>) {
  return (
    <div
      className="inline-flex overflow-hidden rounded-md border border-stone-300"
      role="group"
      aria-label={label}
    >
      {options.map((option, i) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          aria-pressed={option.value === value}
          className={`${BUTTON} ${i > 0 ? 'border-l border-stone-300' : ''} ${
            option.value === value
              ? 'bg-stone-900 text-white'
              : 'bg-white text-stone-600 hover:bg-stone-50 hover:text-stone-900'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
