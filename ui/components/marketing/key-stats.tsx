type KeyStat = {
  label: string
  value: string
  detail: string
}

export function KeyStats({ stats }: { stats: KeyStat[] }) {
  return (
    <dl className="grid gap-4 md:grid-cols-3">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-3xl border border-[color:var(--mk-border)] bg-white p-6 shadow-mk-sm">
          <dt className="text-sm font-semibold text-[color:var(--mk-text-subtle)]">{stat.label}</dt>
          <dd className="mt-3 font-display text-4xl font-bold tracking-[-0.04em] text-[color:var(--mk-navy-900)]">
            {stat.value}
          </dd>
          <p className="mt-2 text-sm leading-6 text-[color:var(--mk-text-muted)]">{stat.detail}</p>
        </div>
      ))}
    </dl>
  )
}
