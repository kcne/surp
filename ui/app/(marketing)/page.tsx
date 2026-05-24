import type { Metadata } from "next"
import Link from "next/link"
import { CtaBand } from "@/components/marketing/cta-band"
import { FAQ, faqItems } from "@/components/marketing/faq"
import { FeaturesGrid } from "@/components/marketing/features-grid"
import { FeatureSpotlight } from "@/components/marketing/feature-spotlight"
import { MarketingHero } from "@/components/marketing/hero"
import { LogoBar } from "@/components/marketing/logo-bar"
import { PricingTeaser } from "@/components/marketing/pricing-teaser"
import { ProblemFraming } from "@/components/marketing/problem-framing"
import { Testimonials } from "@/components/marketing/testimonials"
import { landingPages } from "@/lib/landing-pages"
import { absoluteUrl, buildMetadata, jsonLd, siteConfig } from "@/lib/seo"

export const metadata: Metadata = {
  ...buildMetadata({
    title: "Softver za autobuske agencije",
    description: siteConfig.description,
  }),
  title: {
    absolute: "Softver za autobuske agencije",
  },
}

export default function MarketingHomePage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${absoluteUrl("/")}#organization`,
        name: siteConfig.name,
        url: absoluteUrl("/"),
        description: siteConfig.description,
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "sales",
          availableLanguage: ["sr-Latn"],
        },
      },
      {
        "@type": "WebSite",
        "@id": `${absoluteUrl("/")}#website`,
        name: siteConfig.name,
        url: absoluteUrl("/"),
        publisher: {
          "@id": `${absoluteUrl("/")}#organization`,
        },
      },
      {
        "@type": "SoftwareApplication",
        name: siteConfig.name,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: absoluteUrl("/"),
        description: siteConfig.description,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "EUR",
          description: "Zakazite demo za personalizovanu ponudu.",
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: faqItems.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }}
      />
      <MarketingHero />
      <LogoBar />
      <ProblemFraming />
      <FeaturesGrid />
      <section className="bg-white py-20 md:py-28">
        <div className="mx-auto w-full max-w-7xl px-6 md:px-8 lg:px-12">
          <div className="mb-10 max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mk-indigo-600)]">
              Najtrazenije teme
            </p>
            <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.025em] text-[color:var(--mk-navy-900)] md:text-5xl">
              Procitajte vise o temama koje agencije najcesce pretrazuju.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {landingPages.map((page) => (
              <Link key={page.slug} href={`/${page.slug}`} className="rounded-3xl border border-[color:var(--mk-border)] bg-[color:var(--mk-bg-alt)] p-6 shadow-mk-sm transition hover:-translate-y-0.5 hover:shadow-mk-md">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--mk-indigo-600)]">{page.eyebrow}</p>
                <h3 className="mt-3 font-display text-2xl font-semibold tracking-[-0.025em] text-[color:var(--mk-navy-900)]">{page.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[color:var(--mk-text-muted)]">{page.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <FeatureSpotlight
        eyebrow="Online rezervacije"
        title="Omogucite putnicima da pronadju vase polaske i rezervisu online."
        description="Nas softver za autobuske agencije povezuje vas javni izlog i operativni panel, pa su svi podaci centralizovani."
        bullets={[
          "Javni sajt vase agencije koji putnici mogu lakse da pronadju na Google-u",
          "Brending kroz logo, boje, hero slike i sekcije",
          "Rezervacije ulaze direktno u operativni pregled",
        ]}
        cta="Vise informacija"
        href="/funkcije"
        visual="storefront"
      />
      <FeatureSpotlight
        eyebrow="Multi-agencijske operacije"
        title="Vise agencija, polazaka i prodaje pod jednim administrativnim panelom."
        description="Za agencije koje vode vise linija, prodajnih kanala ili pravnih lica, SURP postavlja prave granice i daje cist pregled."
        bullets={[
          "Bezbedno razdvajanje podataka izmedju agencija i brendova",
          "Operativni panel ostaje fokusiran na svakodnevni rad",
          "Javni izlog za svaki brend bez dodatnog alata",
        ]}
        cta="Procitajte vise za agencije"
        href="/za-agencije"
        visual="multi-agency"
        dark
        reverse
      />
      <Testimonials />
      <PricingTeaser />
      <FAQ />
      <CtaBand />
    </>
  )
}
