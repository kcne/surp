import Link from "next/link"
import { CheckCircle2 } from "lucide-react"
import { AnswerBlock } from "@/components/marketing/answer-block"
import { CtaBand } from "@/components/marketing/cta-band"
import { KeyStats } from "@/components/marketing/key-stats"
import { MarketingSection } from "@/components/marketing/section"
import type { LandingPage } from "@/lib/landing-pages"
import { absoluteUrl, breadcrumbJsonLd, jsonLd, softwareApplicationJsonLd } from "@/lib/seo"

type SeoLandingPageProps = {
  page: LandingPage
}

export function SeoLandingPage({ page }: SeoLandingPageProps) {
  const path = `/${page.slug}`
  const breadcrumbs = breadcrumbJsonLd([
    { name: "SURP", path: "/" },
    { name: page.title, path },
  ])
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  }
  const softwareJsonLd = softwareApplicationJsonLd({
    name: page.title,
    url: absoluteUrl(path),
    description: page.tldr ?? page.description,
  })

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(softwareJsonLd) }} />
      <MarketingSection className="bg-[color:var(--mk-bg)]">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mk-indigo-600)]">{page.eyebrow}</p>
          {page.tldr ? (
            <div
              role="note"
              aria-label="TL;DR"
              className="mx-auto mt-5 max-w-2xl rounded-2xl border border-[color:var(--mk-indigo-100)] bg-[color:var(--mk-indigo-50)] px-5 py-3 text-left"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--mk-indigo-600)]">TL;DR</p>
              <p className="mt-1 text-sm leading-6 text-[color:var(--mk-navy-900)]">{page.tldr}</p>
            </div>
          ) : null}
          <h1 className="mt-4 font-display text-5xl font-bold tracking-[-0.035em] text-[color:var(--mk-navy-900)] md:text-6xl">
            {page.h1}
          </h1>
          <p className="mt-6 text-lg leading-8 text-[color:var(--mk-text-muted)] md:text-xl">{page.description}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={buildContactHref(page.slug, "hero-primary")}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[color:var(--mk-indigo-600)] px-6 py-3 text-sm font-semibold text-white shadow-mk-glow sm:w-auto"
            >
              Zakazite demo
            </Link>
            <Link
              href="/cene"
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-[color:var(--mk-border)] bg-white px-6 py-3 text-sm font-semibold text-[color:var(--mk-navy-900)] sm:w-auto"
            >
              Pogledajte cene
            </Link>
          </div>
          <p className="mt-3 text-xs text-[color:var(--mk-text-subtle)]">Bez obaveze. Prvi predlog implementacije dobijate nakon kratkog poziva.</p>
          <p className="mt-5 text-sm text-[color:var(--mk-text-subtle)]">
            Azurirano: <time dateTime={page.updatedAt}>{formatDate(page.updatedAt)}</time>
          </p>
        </div>
        <div className="mx-auto mt-10 max-w-4xl">
          <AnswerBlock title={page.title}>
            <p>{page.answer}</p>
          </AnswerBlock>
        </div>
      </MarketingSection>

      <MarketingSection className="bg-[color:var(--mk-bg-alt)]">
        <KeyStats stats={page.stats} />
      </MarketingSection>

      <MarketingSection className="bg-white">
        <div className="grid gap-6 lg:grid-cols-3">
          {page.sections.map((section) => (
            <article key={section.title} className="rounded-3xl border border-[color:var(--mk-border)] bg-[color:var(--mk-bg-alt)] p-7 shadow-mk-sm">
              <h2 className="font-display text-2xl font-semibold tracking-[-0.025em] text-[color:var(--mk-navy-900)]">{section.title}</h2>
              <p className="mt-4 text-base leading-7 text-[color:var(--mk-text-muted)]">{section.body}</p>
              <ul className="mt-6 space-y-3">
                {section.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-3 text-sm leading-6 text-[color:var(--mk-text-muted)]">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--mk-success)]" />
                    {bullet}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection className="bg-[color:var(--mk-bg-alt)]">
        <div className="mb-10 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mk-indigo-600)]">Poredjenje</p>
          <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.025em] text-[color:var(--mk-navy-900)] md:text-5xl">
            SURP u odnosu na rucni rad
          </h2>
        </div>
        <div className="overflow-hidden rounded-3xl border border-[color:var(--mk-border)] bg-white shadow-mk-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-[color:var(--mk-navy-900)] text-white">
              <tr>
                <th className="px-5 py-4 font-semibold">Oblast</th>
                <th className="px-5 py-4 font-semibold">Rucno / Excel</th>
                <th className="px-5 py-4 font-semibold">SURP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--mk-border)]">
              {page.comparison.map((row) => (
                <tr key={row.area}>
                  <th className="px-5 py-4 font-semibold text-[color:var(--mk-navy-900)]">{row.area}</th>
                  <td className="px-5 py-4 text-[color:var(--mk-text-muted)]">{row.manual}</td>
                  <td className="px-5 py-4 text-[color:var(--mk-text-muted)]">{row.surp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MarketingSection>

      <MarketingSection className="bg-white">
        <div className="mx-auto grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mk-indigo-600)]">FAQ</p>
            <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.025em] text-[color:var(--mk-navy-900)] md:text-5xl">
              Najcesca pitanja
            </h2>
            <p className="mt-4 text-lg leading-8 text-[color:var(--mk-text-muted)]">
              Kratki odgovori na pitanja koja agencije najcesce imaju pre uvodjenja novog sistema.
            </p>
            <div className="mt-6 rounded-2xl border border-[color:var(--mk-border)] bg-[color:var(--mk-bg-alt)] p-5">
              <p className="text-sm font-semibold text-[color:var(--mk-navy-900)]">Hocete procenu za vasu agenciju?</p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--mk-text-muted)]">
                Posaljite broj linija i kako trenutno vodite rezervacije. Vraticemo konkretan predlog prvog koraka.
              </p>
              <Link
                href={buildContactHref(page.slug, "faq-side")}
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-[color:var(--mk-indigo-600)] px-5 py-2.5 text-sm font-semibold text-white"
              >
                Posaljite upit
              </Link>
            </div>
          </div>
          <div className="space-y-3">
            {page.faq.map((item) => (
              <details key={item.question} className="group rounded-2xl border border-[color:var(--mk-border)] bg-[color:var(--mk-bg-alt)] p-5 shadow-mk-sm">
                <summary className="cursor-pointer list-none font-semibold text-[color:var(--mk-navy-900)] marker:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {item.question}
                    <span className="text-xl text-[color:var(--mk-indigo-600)] transition-transform group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-4 text-sm leading-6 text-[color:var(--mk-text-muted)]">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </MarketingSection>

      <MarketingSection className="bg-[color:var(--mk-bg-alt)]">
        <div className="rounded-[2rem] border border-[color:var(--mk-border)] bg-white p-8 shadow-mk-md lg:p-10">
          <h2 className="font-display text-3xl font-semibold tracking-[-0.025em] text-[color:var(--mk-navy-900)]">
            Zelite da vidite kako bi ovo radilo u vasoj agenciji?
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-7 text-[color:var(--mk-text-muted)]">
            Posaljite nam kako sada vodite linije i rezervacije, pa cemo predloziti prvi praktican korak.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href={buildContactHref(page.slug, "bottom-primary")}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-[color:var(--mk-indigo-600)] px-6 py-3 text-sm font-semibold text-white shadow-mk-glow"
            >
              Zakazite demo
            </Link>
            <Link
              href="/funkcije"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-[color:var(--mk-border)] bg-white px-6 py-3 text-sm font-semibold text-[color:var(--mk-navy-900)]"
            >
              Pogledajte funkcije
            </Link>
          </div>
          <p className="mt-3 text-xs text-[color:var(--mk-text-subtle)]">Bez ugovorne obaveze za uvodni razgovor.</p>
        </div>
      </MarketingSection>
      <CtaBand />
    </>
  )
}

function buildContactHref(slug: string, section: string) {
  const params = new URLSearchParams({
    source: "seo-landing",
    page: slug,
    section,
  })
  return `/kontakt?${params.toString()}`
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("sr-Latn-RS", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date))
}
