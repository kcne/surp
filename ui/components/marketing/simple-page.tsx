import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { MarketingSection } from "@/components/marketing/section"

type SimpleMarketingPageProps = {
  eyebrow: string
  title: string
  description: string
  items?: string[]
}

export function SimpleMarketingPage({ eyebrow, title, description, items = [] }: SimpleMarketingPageProps) {
  return (
    <MarketingSection className="min-h-[62vh] bg-[color:var(--mk-bg)]">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mk-indigo-600)]">
          {eyebrow}
        </p>
        <h1 className="mt-4 font-display text-5xl font-bold tracking-[-0.035em] text-[color:var(--mk-navy-900)] md:text-6xl">
          {title}
        </h1>
        <p className="mt-6 text-lg leading-8 text-[color:var(--mk-text-muted)] md:text-xl">
          {description}
        </p>

        {items.length > 0 ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {items.map((item) => (
              <div key={item} className="rounded-2xl border border-[color:var(--mk-border)] bg-white p-5 shadow-mk-sm">
                <p className="font-semibold text-[color:var(--mk-navy-900)]">{item}</p>
              </div>
            ))}
          </div>
        ) : null}

        <Link
          href="/kontakt"
          className="mt-10 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[color:var(--mk-indigo-600)] px-6 py-3 text-sm font-semibold text-white shadow-mk-glow transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mk-indigo-600)] focus-visible:ring-offset-2"
        >
          Zakazite demo
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </MarketingSection>
  )
}
