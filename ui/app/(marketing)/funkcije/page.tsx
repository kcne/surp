import type { Metadata } from "next"
import Link from "next/link"
import { BarChart3, Calendar, CheckCircle2, Globe, Route, Ticket, Users } from "lucide-react"
import { CtaBand } from "@/components/marketing/cta-band"
import { MarketingSection } from "@/components/marketing/section"
import { breadcrumbJsonLd, buildMetadata, jsonLd } from "@/lib/seo"

export const metadata: Metadata = buildMetadata({
  title: "Funkcije",
  description: "Softver za autobuske agencije: linije, vozni redovi, rezervacije, putnici, storefront i izvestaji.",
  path: "/funkcije",
})

const featureDetails = [
  {
    icon: Route,
    title: "Linije i stanice",
    description:
      "Modelujte stvarnu mrezu prevoza: polazne i dolazne stanice, medjustanice, redosled, segmente i poslovna pravila.",
    bullets: ["Jedan izvor istine za rute", "Spremno za cene po segmentu", "Pregled koji razume operativni tim"],
  },
  {
    icon: Calendar,
    title: "Vozni redovi",
    description:
      "Planirajte redovne, sezonske i ad-hoc polaske bez rucnog preslikavanja podataka kroz tabele.",
    bullets: ["Dnevni i sezonski rasporedi", "Brze izmene polazaka", "Manje gresaka u komunikaciji"],
  },
  {
    icon: Ticket,
    title: "Rezervacije",
    description:
      "Centralizujte manuelne i online rezervacije tako da tim u svakom trenutku zna sta je prodato, rezervisano i slobodno.",
    bullets: ["Pregled zauzeca po polasku", "Manuelni unos iz call centra", "Online tok kroz storefront"],
  },
  {
    icon: Users,
    title: "Putnici",
    description:
      "Gradite bazu putnika i istoriju rezervacija kao osnovu za bolju podrsku, prodaju i buduce loyalty funkcije.",
    bullets: ["Pretraga i istorija", "Manje duplih unosa", "Bolji kontekst za podrsku"],
  },
  {
    icon: Globe,
    title: "Javni sajt agencije",
    description:
      "Svaka agencija dobija storefront koji moze da nosi logo, boje, hero poruku, slike i online rezervacije.",
    bullets: ["SEO-friendly SSR strane", "Brending po agenciji", "Rezervacije povezane sa dashboard-om"],
  },
  {
    icon: BarChart3,
    title: "Izvestaji",
    description:
      "Pratite popunjenost, prihode po liniji i operativne trendove bez rucnog spajanja vise izvora.",
    bullets: ["Popunjenost po polasku", "Top destinacije", "Osnova za revenue odluke"],
  },
]

export default function FunkcijePage() {
  const breadcrumbs = breadcrumbJsonLd([
    { name: "SURP", path: "/" },
    { name: "Funkcije", path: "/funkcije" },
  ])

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }} />
      <MarketingSection className="bg-[color:var(--mk-bg)]">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mk-indigo-600)]">
            Funkcije
          </p>
          <h1 className="mt-4 font-display text-5xl font-bold tracking-[-0.035em] text-[color:var(--mk-navy-900)] md:text-6xl">
            Softver za autobuske agencije koji pokriva ceo operativni tok.
          </h1>
          <p className="mt-6 text-lg leading-8 text-[color:var(--mk-text-muted)] md:text-xl">
            SURP spaja planiranje linija, rezervacije, putnike, javni sajt i
            izvestaje u jedan sistem koji je razumljiv operativi i koristan prodaji.
          </p>
        </div>
      </MarketingSection>

      <MarketingSection className="bg-[color:var(--mk-bg-alt)]">
        <div className="grid gap-6 lg:grid-cols-2">
          {featureDetails.map((feature) => {
            const Icon = feature.icon

            return (
              <article key={feature.title} className="rounded-3xl border border-[color:var(--mk-border)] bg-white p-7 shadow-mk-sm">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--mk-indigo-100)] text-[color:var(--mk-indigo-600)]">
                  <Icon className="h-7 w-7" />
                </div>
                <h2 className="font-display text-3xl font-semibold tracking-[-0.025em] text-[color:var(--mk-navy-900)]">
                  {feature.title}
                </h2>
                <p className="mt-4 text-base leading-7 text-[color:var(--mk-text-muted)]">{feature.description}</p>
                <ul className="mt-6 space-y-3">
                  {feature.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-3 text-sm text-[color:var(--mk-text-muted)]">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-[color:var(--mk-success)]" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </article>
            )
          })}
        </div>
      </MarketingSection>

      <MarketingSection className="bg-white">
        <div className="grid items-center gap-10 rounded-[2rem] border border-[color:var(--mk-border)] bg-[color:var(--mk-bg-alt)] p-8 shadow-mk-md lg:grid-cols-[1fr_auto] lg:p-10">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-[-0.025em] text-[color:var(--mk-navy-900)]">
              Niste sigurni koje funkcije su vam potrebne prvo?
            </h2>
            <p className="mt-3 text-base leading-7 text-[color:var(--mk-text-muted)]">
              Demo mozemo voditi kroz vas konkretan proces: broj linija, nacin
              prodaje, trenutne tabele i kanale rezervacije.
            </p>
          </div>
          <Link
            href="/kontakt"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-[color:var(--mk-indigo-600)] px-6 py-3 text-sm font-semibold text-white shadow-mk-glow"
          >
            Zakazite demo
          </Link>
        </div>
      </MarketingSection>
      <CtaBand />
    </>
  )
}
