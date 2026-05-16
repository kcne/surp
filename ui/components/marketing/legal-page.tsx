import { MarketingSection } from "@/components/marketing/section"

type LegalSection = {
  title: string
  body: string[]
}

type LegalPageProps = {
  title: string
  description: string
  updatedAt: string
  sections: LegalSection[]
}

export function LegalPage({ title, description, updatedAt, sections }: LegalPageProps) {
  return (
    <MarketingSection className="bg-[color:var(--mk-bg)]">
      <div className="grid gap-12 lg:grid-cols-[0.75fr_1.25fr]">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mk-indigo-600)]">
            Pravno
          </p>
          <h1 className="mt-4 font-display text-5xl font-bold tracking-[-0.035em] text-[color:var(--mk-navy-900)] md:text-6xl">
            {title}
          </h1>
          <p className="mt-5 text-lg leading-8 text-[color:var(--mk-text-muted)]">{description}</p>
          <p className="mt-6 rounded-2xl border border-[color:var(--mk-border)] bg-[color:var(--mk-bg-alt)] px-4 py-3 text-sm text-[color:var(--mk-text-muted)]">
            Poslednja izmena: <time dateTime={updatedAt}>{formatLegalDate(updatedAt)}</time>
          </p>
          <nav aria-label="Sadrzaj pravne strane" className="mt-6 hidden rounded-2xl border border-[color:var(--mk-border)] bg-white p-4 shadow-mk-sm lg:block">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--mk-text-subtle)]">
              Sadrzaj
            </p>
            <ol className="space-y-2">
              {sections.map((section, index) => (
                <li key={section.title}>
                  <a href={`#section-${index + 1}`} className="text-sm font-medium text-[color:var(--mk-text-muted)] transition hover:text-[color:var(--mk-indigo-600)]">
                    {index + 1}. {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <article className="mk-surface rounded-[2rem] p-6 shadow-mk-sm md:p-10">
          <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50/85 p-4 text-sm leading-6 text-amber-900">
            Ovaj tekst je radna verzija za proizvod i treba ga pravno uskladiti
            pre javnog lansiranja.
          </div>

          <div className="space-y-10">
            {sections.map((section, index) => (
              <section key={section.title} id={`section-${index + 1}`} className="scroll-mt-28">
                <h2 className="font-display text-3xl font-semibold tracking-[-0.025em] text-[color:var(--mk-navy-900)]">
                  {index + 1}. {section.title}
                </h2>
                <div className="mt-4 space-y-4">
                  {section.body.map((paragraph) => (
                    <p key={paragraph} className="text-base leading-8 text-[color:var(--mk-text-muted)]">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </article>
      </div>
    </MarketingSection>
  )
}

function formatLegalDate(date: string) {
  return new Intl.DateTimeFormat("sr-Latn-RS", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(date))
}
