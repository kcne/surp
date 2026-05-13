export interface StorefrontSections {
  hero: boolean
  rides: boolean
  about: boolean
}

export interface StorefrontSocialLinks {
  facebookUrl: string | null
  instagramUrl: string | null
  twitterUrl: string | null
  linkedinUrl: string | null
  websiteUrl: string | null
}

export interface PublicStorefrontRideSummary {
  id: string
  lineName: string
  origin: string
  destination: string
  departureTimes: string[]
  days: string
}

export interface PublicAgencyStorefront {
  slug: string
  name: string
  timezone: string | null
  status: "DRAFT" | "PUBLISHED"
  publishedAt: string | null
  heroTitle: string | null
  heroSubtitle: string | null
  heroImageUrl: string | null
  heroImageAlt: string | null
  aboutMarkdown: string | null
  footerText: string | null
  logoUrl: string | null
  logoAlt: string | null
  primaryColor: string | null
  sectionsEnabled: StorefrontSections
  seoTitle: string | null
  seoDescription: string | null
  ogImageUrl: string | null
  socialLinks: StorefrontSocialLinks
  rides: PublicStorefrontRideSummary[]
  updatedAt: string
}

export interface StorefrontAdminResponse
  extends Omit<PublicAgencyStorefront, "slug" | "name" | "timezone"> {
  tenantId: string
  tenantSlug: string
  tenantName: string
}

export type StorefrontUpdatePayload = Partial<
  Pick<
    PublicAgencyStorefront,
    | "heroTitle"
    | "heroSubtitle"
    | "heroImageUrl"
    | "heroImageAlt"
    | "aboutMarkdown"
    | "footerText"
    | "logoUrl"
    | "logoAlt"
    | "primaryColor"
    | "sectionsEnabled"
    | "seoTitle"
    | "seoDescription"
    | "ogImageUrl"
  >
> &
  Partial<StorefrontSocialLinks>

const DEFAULT_API_URL = "http://127.0.0.1:3001"

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL
}

export async function fetchPublicAgencyStorefront(slug: string): Promise<PublicAgencyStorefront | null> {
  const response = await fetch(`${getApiBaseUrl()}/api/public/agencies/${encodeURIComponent(slug)}`, {
    next: {
      revalidate: 60,
      tags: [`agency:${slug}`],
    },
  })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error("Greška pri učitavanju javnog izloga agencije")
  }

  return response.json()
}

export function storefrontDisplayTitle(storefront: Pick<PublicAgencyStorefront, "seoTitle" | "heroTitle" | "name">) {
  return storefront.seoTitle || storefront.heroTitle || storefront.name
}
