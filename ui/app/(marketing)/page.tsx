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
        title="Putnici rezervisu online. Tim vidi rezervaciju odmah."
        description="SURP povezuje javni storefront i operativni dashboard, pa isti podaci zive u jednom sistemu."
        bullets={[
          "SEO-friendly javni sajt za svaku agenciju",
          "Brending kroz logo, boje, hero slike i sekcije",
          "Rezervacije ulaze direktno u operativni pregled",
        ]}
        cta="Pogledajte funkcije"
        href="/funkcije"
      />
      <FeatureSpotlight
        eyebrow="Multi-brand operacije"
        title="Vise brendova, jedan operativni pogled."
        description="Za agencije koje vode vise linija, prodajnih kanala ili pravnih lica, SURP zadrzava tenant granice i cist pregled."
        bullets={[
          "Tenant-scoped arhitektura za bezbedno razdvajanje podataka",
          "Staff dashboard ostaje fokusiran na dnevni rad",
          "Javni storefront za svaki brend bez dodatnog alata",
        ]}
        cta="Procitajte za agencije"
        href="/za-agencije"
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
