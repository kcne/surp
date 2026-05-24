import type { MetadataRoute } from "next"
import { getAllBlogPosts } from "@/lib/blog"
import { landingPages } from "@/lib/landing-pages"
import { absoluteUrl } from "@/lib/seo"

export const revalidate = 3600

const marketingRoutes = [
  "/",
  "/funkcije",
  "/cene",
  "/za-agencije",
  "/blog",
  "/kontakt",
  "/uslovi-koriscenja",
  "/politika-privatnosti",
  ...landingPages.map((page) => `/${page.slug}`),
]

type SitemapData = {
  agencies: Array<{
    slug: string
    updatedAt: string
  }>
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticRoutes = marketingRoutes.map((route) => ({
    url: absoluteUrl(route),
    lastModified: now,
    changeFrequency: route === "/" ? ("weekly" as const) : ("monthly" as const),
    priority: route === "/" ? 1 : 0.7,
  }))

  const blogRoutes = getAllBlogPosts().map((post) => ({
    url: absoluteUrl(`/blog/${post.slug}`),
    lastModified: new Date(post.date),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }))

  const storefrontRoutes = (await fetchSitemapData()).agencies.map((agency) => ({
    url: absoluteUrl(`/${agency.slug}`),
    lastModified: new Date(agency.updatedAt),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }))

  return [...staticRoutes, ...blogRoutes, ...storefrontRoutes]
}

async function fetchSitemapData(): Promise<SitemapData> {
  const apiBaseUrl = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001"

  try {
    const response = await fetch(`${apiBaseUrl}/api/public/seo/sitemap-data`, {
      next: {
        revalidate,
      },
    })

    if (!response.ok) {
      return { agencies: [] }
    }

    return response.json()
  } catch (error) {
    console.error("Failed to fetch public SEO sitemap data", error)
    return { agencies: [] }
  }
}
