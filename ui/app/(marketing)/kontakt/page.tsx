import type { Metadata } from "next"
import { CalendarDays, CheckCircle2, Mail, Phone } from "lucide-react"
import { DemoForm } from "@/components/marketing/contact/demo-form"
import { MarketingSection } from "@/components/marketing/section"
import { breadcrumbJsonLd, buildMetadata, jsonLd } from "@/lib/seo"

export const metadata: Metadata = buildMetadata({
  title: "Kontakt",
  description: "Zakazite SURP demo i saznajte kako platforma moze da podrzi operacije vase autobuske agencije.",
  path: "/kontakt",
})

export default function KontaktPage() {
  const contactEmail = process.env.NEXT_PUBLIC_MARKETING_CONTACT_EMAIL ?? "contact@surp.rs"
  const breadcrumbs = breadcrumbJsonLd([
    { name: "SURP", path: "/" },
    { name: "Kontakt", path: "/kontakt" },
  ])

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }} />
      <MarketingSection className="bg-[color:var(--mk-bg)]">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mk-indigo-600)]">
            Kontakt
          </p>
          <h1 className="mt-4 font-display text-5xl font-bold tracking-[-0.035em] text-[color:var(--mk-navy-900)] md:text-6xl">
            Zakazite demo za vasu autobusku agenciju.
          </h1>
          <p className="mt-6 text-lg leading-8 text-[color:var(--mk-text-muted)] md:text-xl">
            Pokazujemo SURP kroz vase realne tokove: linije, rezervacije,
            putnike, storefront i izvestaje.
          </p>
        </div>
      </MarketingSection>

      <MarketingSection className="bg-[color:var(--mk-bg-alt)] pt-0">
        <div className="grid items-start gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <DemoForm />

          <div className="space-y-5">
            <div className="mk-noise-bg mk-gradient-divider overflow-hidden rounded-[2rem] border border-white/10 bg-[color:var(--mk-navy-900)] p-6 text-white shadow-mk-lg md:p-8">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white">
                <CalendarDays className="h-6 w-6" />
              </div>
              <h2 className="font-display text-3xl font-semibold tracking-[-0.025em]">
                Sta dobijate na demo-u?
              </h2>
              <ul className="mt-6 space-y-4">
                {[
                  "Pregled kako izgleda operativni dashboard",
                  "Primer javnog storefront-a za agenciju",
                  "Procenu implementacije prema vasem obimu",
                  "Preporuku Starter / Pro / Enterprise plana",
                ].map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-6 text-slate-200">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--mk-success)]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[2rem] border border-[color:var(--mk-border)] bg-white p-6 shadow-mk-sm md:p-8">
              <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-[color:var(--mk-navy-900)]">
                Direktan kontakt
              </h2>
              <div className="mt-5 space-y-4 text-sm text-[color:var(--mk-text-muted)]">
                <a href={`mailto:${contactEmail}`} className="flex items-center gap-3 hover:text-[color:var(--mk-indigo-600)]">
                  <Mail className="h-5 w-5" />
                  {contactEmail}
                </a>
                <a href="tel:+381654224233" className="flex items-center gap-3 hover:text-[color:var(--mk-indigo-600)]">
                  <Phone className="h-5 w-5" />
                  +381 65 422 4233
                </a>
              </div>
              <div className="mt-6 rounded-2xl bg-[color:var(--mk-bg-alt)] p-4 text-sm leading-6 text-[color:var(--mk-text-muted)]">
                Cal.com embed se dodaje cim se zakljuca javni demo link. Forma
                vec prikuplja isti lead intake i salje ga na email.
              </div>
            </div>
          </div>
        </div>
      </MarketingSection>
    </>
  )
}
