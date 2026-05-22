import type { Metadata } from "next"
import { CtaBand } from "@/components/marketing/cta-band"
import { FAQ, faqItems } from "@/components/marketing/faq"
import { FeaturesGrid } from "@/components/marketing/features-grid"
import { FeatureSpotlight } from "@/components/marketing/feature-spotlight"
import { MarketingHero } from "@/components/marketing/hero"
import { LogoBar } from "@/components/marketing/logo-bar"
import { PricingTeaser } from "@/components/marketing/pricing-teaser"
import { ProblemFraming } from "@/components/marketing/problem-framing"
import { Testimonials } from "@/components/marketing/testimonials"
import { absoluteUrl, buildMetadata, jsonLd, siteConfig } from "@/lib/seo"

export const metadata: Metadata = buildMetadata({
  title: "Sistem za autobuske agencije",
  description:
    "SURP objedinjuje linije, vozne redove, rezervacije, putnike i javni sajt autobuske agencije.",
})

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
