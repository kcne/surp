type AnswerBlockProps = {
  eyebrow?: string
  title?: string
  children: React.ReactNode
}

export function AnswerBlock({ eyebrow = "Kratak odgovor", title, children }: AnswerBlockProps) {
  return (
    <aside className="rounded-3xl border border-[color:var(--mk-indigo-100)] bg-[color:var(--mk-indigo-50)] p-6 shadow-mk-sm">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mk-indigo-600)]">{eyebrow}</p>
      {title ? (
        <h2 className="mt-3 font-display text-2xl font-semibold tracking-[-0.025em] text-[color:var(--mk-navy-900)]">
          {title}
        </h2>
      ) : null}
      <div className="mt-3 text-base leading-7 text-[color:var(--mk-text-muted)]">{children}</div>
    </aside>
  )
}
