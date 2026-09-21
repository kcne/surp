import type { Metadata } from "next"
import { SeoLandingPage } from "@/components/marketing/seo-landing-page"
import { getLandingPage } from "@/lib/landing-pages"
import { buildMetadata } from "@/lib/seo"

const page = getLandingPage("sistem-za-rezervacije-autobusa")!

export const metadata: Metadata = buildMetadata({
  title: page.title,
  description: page.description,
  path: `/${page.slug}`,
})

export default function SistemZaRezervacijeAutobusaPage() {
  return <SeoLandingPage page={page} />
}
