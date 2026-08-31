/** Shared typography for the About dialog and its glossary. */

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h3 className="text-xs font-bold tracking-[0.18em] text-stone-500 uppercase">{title}</h3>
      {children}
    </section>
  )
}

export function P({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return <p className={`text-sm leading-relaxed text-stone-600 ${className}`}>{children}</p>
}

export function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-stone-900">{children}</strong>
}

export function Code({ children }: { children: string }) {
  return (
    <code className="rounded-xs bg-stone-100 px-1 py-px font-mono text-[0.8125rem] text-stone-700">
      {children}
    </code>
  )
}

export function A({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-stone-900 underline underline-offset-2 hover:text-stone-600"
    >
      {children}
    </a>
  )
}
