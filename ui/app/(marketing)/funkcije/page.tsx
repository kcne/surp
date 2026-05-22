import type { Metadata } from "next"
import Link from "next/link"
import { BarChart3, Calendar, CheckCircle2, Globe, Route, Ticket, Users } from "lucide-react"
import { CtaBand } from "@/components/marketing/cta-band"
import { MarketingSection } from "@/components/marketing/section"
import { breadcrumbJsonLd, buildMetadata, jsonLd } from "@/lib/seo"

export const metadata: Metadata = buildMetadata({
  title: "Softver za autobuske agencije",
  description: "Alati za autobuske agencije: linije, polasci, rezervacije, putnici, javni sajt i prodaja karata online.",
  path: "/funkcije",
})

const featureDetails = [
  {
    icon: Route,
    title: "Linije i stanice",
    description:
      "Unesite linije, stanice, medjustanice i cene onako kako stvarno radi vasa autobuska agencija.",
    bullets: ["Neogranicen broj stanica", "Cene i pravila po liniji", "Vasi podaci, vasa kontrola"],
  },
  {
    icon: Calendar,
    title: "Vozni redovi",
    description:
      "Vodite polaske, dane voznje i sezonske izmene bez prepisivanja kroz tabele i poruke.",
    bullets: ["Redovni i sezonski polasci", "Brze izmene voznih redova", "Jasan pregled za ceo tim"],
  },
  {
    icon: Ticket,
    title: "Rezervacije",
    description:
      "Sve rezervacije drzite na jednom mestu, bilo da dolaze telefonom, porukom, iz agencije ili preko interneta.",
    bullets: ["Pregled slobodnih i zauzetih mesta", "Rucni unos rezervacija", "Online rezervacije sa javnog sajta"],
  },
  {
    icon: Users,
    title: "Putnici",
    description:
      "Sacuvajte podatke o putnicima i istoriju rezervacija kako bi vas tim brze pronasao informacije kada su potrebne.",
    bullets: ["Baza putnika", "Istorija rezervacija", "Manje duplih unosa"],
  },
  {
    icon: Globe,
    title: "Javni sajt agencije",
    description:
      "Napravite javni sajt za agenciju na kome putnici mogu da pronadju polaske i posalju online rezervaciju.",
    bullets: [
      "Sajt koji putnici mogu lakse da pronadju na Google-u",
      "Logo, boje i slike vase agencije",
      "Rezervacije odmah ulaze u operativni panel",
    ],
  },
  {
    icon: BarChart3,
    title: "Izvestaji",
    description:
      "Pratite popunjenost polazaka, prihode i najtrazenije linije bez rucnog sabiranja iz vise tabela.",
    bullets: ["Popunjenost po polasku", "Prihodi po liniji", "Najtrazenije destinacije"],
  },
]

export default function FunkcijePage() {
  const breadcrumbs = breadcrumbJsonLd([
    { name: "SURP", path: "/" },
    { name: "Softver", path: "/funkcije" },
  ])

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }} />
      <MarketingSection className="bg-[color:var(--mk-bg)]">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mk-indigo-600)]">
            Alati za autobuske agencije
          </p>
          <h1 className="mt-4 font-display text-5xl font-bold tracking-[-0.035em] text-[color:var(--mk-navy-900)] md:text-6xl">
            Sve sto vam treba za online vodjenje autobuske agencije.
          </h1>
          <p className="mt-6 text-lg leading-8 text-[color:var(--mk-text-muted)] md:text-xl">
            Nas softver za autobuske agencije pomaze da upravljate linijama,
            polascima, rezervacijama, putnicima i prodajom karata preko interneta.
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
              Niste sigurni odakle da pocnete?
            </h2>
            <p className="mt-3 text-base leading-7 text-[color:var(--mk-text-muted)]">
              Javite nam se da prodjemo kroz vase trenutne linije, rezervacije i
              nacin prodaje, pa cemo predloziti prvi korak za uvodjenje softvera.
            </p>
          </div>
          <Link
            href="/kontakt"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-[color:var(--mk-indigo-600)] px-6 py-3 text-sm font-semibold text-white shadow-mk-glow"
          >
            Kontaktirajte nas
          </Link>
        </div>
      </MarketingSection>
      <CtaBand />
    </>
  )
}
