import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Clock, TrendingUp, UsersRound } from "lucide-react"
import { CtaBand } from "@/components/marketing/cta-band"
import { MarketingSection } from "@/components/marketing/section"
import { breadcrumbJsonLd, buildMetadata, jsonLd } from "@/lib/seo"

export const metadata: Metadata = buildMetadata({
  title: "Za agencije",
  description: "Kako SURP pomaze autobuskim agencijama da digitalizuju rezervacije, operacije i javni sajt.",
  path: "/za-agencije",
})

const outcomes = [
  {
    icon: Clock,
    metric: "manje rucnog rada",
    title: "Rezervacije bez stalnog prepisivanja",
    description: "Tim radi u jednom dashboard-u, umesto da uskladjuje telefon, poruke i tabele.",
  },
  {
    icon: TrendingUp,
    metric: "bolji pregled prodaje",
    title: "Popunjenost i prihodi postaju vidljivi",
    description: "Odluke o polascima i cenama imaju podatke iza sebe, ne samo osecaj iz smene.",
  },
  {
    icon: UsersRound,
    metric: "bolje iskustvo putnika",
    title: "Putnici nalaze agenciju online",
    description: "Storefront daje jasan, brz i brendiran kanal za informacije i rezervacije.",
  },
]

const steps = [
  "Mapiramo postojece linije, stanice, prodajne kanale i najcesce izuzetke.",
  "Postavljamo tenant, korisnike, osnovne podatke i prvi storefront.",
  "Testiramo realan tok rezervacije sa vasim timom pre produkcije.",
  "Uvodimo izvestaje i dodatne funkcije tek kada osnovni tok radi stabilno.",
]

export default function ZaAgencijePage() {
  const breadcrumbs = breadcrumbJsonLd([
    { name: "SURP", path: "/" },
    { name: "Za agencije", path: "/za-agencije" },
  ])

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }} />
      <MarketingSection className="bg-[color:var(--mk-bg)]">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_0.85fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mk-indigo-600)]">
              Za agencije
            </p>
            <h1 className="mt-4 font-display text-5xl font-bold tracking-[-0.035em] text-[color:var(--mk-navy-900)] md:text-6xl">
              Digitalizacija autobuskog prevoza bez haosa u operativi.
            </h1>
            <p className="mt-6 text-lg leading-8 text-[color:var(--mk-text-muted)] md:text-xl">
              SURP je napravljen za agencije koje moraju da vode dnevne polaske,
              sezonske promene, putnike i prodaju bez gubljenja pregleda.
            </p>
            <Link
              href="/kontakt"
              className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[color:var(--mk-indigo-600)] px-6 py-3 text-sm font-semibold text-white shadow-mk-glow"
            >
              Zakazite demo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="rounded-[2rem] border border-[color:var(--mk-border)] bg-[color:var(--mk-bg-alt)] p-6 shadow-mk-lg">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mk-text-subtle)]">Pre / posle</p>
            <div className="mt-5 grid gap-4">
              <div className="rounded-2xl bg-white p-5 shadow-mk-sm">
                <p className="font-semibold text-[color:var(--mk-danger)]">Pre SURP-a</p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--mk-text-muted)]">
                  Tabele, pozivi, poruke, rucna provera mesta i nejasan online kanal.
                </p>
              </div>
              <div className="rounded-2xl bg-[color:var(--mk-navy-900)] p-5 text-white shadow-mk-sm">
                <p className="font-semibold text-[color:var(--mk-indigo-100)]">Sa SURP-om</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Jedan dashboard za operativu i jedan javni storefront za online intent putnika.
                </p>
              </div>
            </div>
          </div>
        </div>
      </MarketingSection>

      <MarketingSection className="bg-[color:var(--mk-bg-alt)]">
        <div className="grid gap-5 md:grid-cols-3">
          {outcomes.map((outcome) => {
            const Icon = outcome.icon

            return (
              <article key={outcome.title} className="rounded-3xl border border-[color:var(--mk-border)] bg-white p-6 shadow-mk-sm">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--mk-indigo-100)] text-[color:var(--mk-indigo-600)]">
                  <Icon className="h-6 w-6" />
                </div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--mk-indigo-600)]">{outcome.metric}</p>
                <h2 className="mt-3 font-display text-2xl font-semibold tracking-[-0.02em] text-[color:var(--mk-navy-900)]">
                  {outcome.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-[color:var(--mk-text-muted)]">{outcome.description}</p>
              </article>
            )
          })}
        </div>
      </MarketingSection>

      <MarketingSection className="bg-white">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mk-indigo-600)]">
              Implementacija
            </p>
            <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.025em] text-[color:var(--mk-navy-900)] md:text-5xl">
              Uvodjenje bez prekida sezone.
            </h2>
            <p className="mt-4 text-lg leading-8 text-[color:var(--mk-text-muted)]">
              Prvi cilj nije da zamenimo sve procese odjednom, vec da stabilizujemo
              najvazniji tok: linija → polazak → rezervacija → putnik.
            </p>
          </div>
          <ol className="space-y-4">
            {steps.map((step, index) => (
              <li key={step} className="flex gap-4 rounded-2xl border border-[color:var(--mk-border)] bg-[color:var(--mk-bg-alt)] p-5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--mk-indigo-600)] text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <span className="text-sm leading-6 text-[color:var(--mk-text-muted)]">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </MarketingSection>

      <MarketingSection className="mk-noise-bg mk-gradient-divider bg-[color:var(--mk-navy-900)] text-white">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mk-indigo-100)]">
            Fit check
          </p>
          <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.025em] md:text-5xl">
            SURP je najbolji kada operativa vec ima realan obim.
          </h2>
          <ul className="mt-8 grid gap-3 text-left sm:grid-cols-2">
            {[
              "Imate vise redovnih polazaka nedeljno",
              "Rezervacije dolaze iz vise kanala",
              "Zelite javni online kanal za agenciju",
              "Treba vam bolji pregled popunjenosti",
            ].map((item) => (
              <li key={item} className="flex gap-3 text-sm text-slate-200">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-[color:var(--mk-success)]" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </MarketingSection>
      <CtaBand />
    </>
  )
}
