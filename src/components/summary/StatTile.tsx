interface Props {
  label: string
  value: string
  note: string
  /** Optional second line, e.g. what NFL staffs do for comparison. */
  benchmark?: string
}

/** One headline number. Shared by the team profile and the quiz scorecard. */
export function StatTile({ label, value, note, benchmark }: Props) {
  return (
    <div className="rounded-md border border-stone-200 bg-white p-3">
      <dt className="text-[0.625rem] font-bold tracking-[0.14em] text-stone-500 uppercase">
        {label}
      </dt>
      <dd className="tnum mt-1 text-2xl leading-none font-bold text-stone-900">{value}</dd>
      <dd className="mt-1.5 text-[0.6875rem] leading-tight text-stone-500">{note}</dd>
      {benchmark && (
        <dd className="tnum mt-1 text-[0.6875rem] leading-tight font-medium text-stone-400">
          {benchmark}
        </dd>
      )}
    </div>
  )
}
