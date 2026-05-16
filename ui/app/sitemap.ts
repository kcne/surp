import type { MetadataRoute } from "next"
import { getAllBlogPosts } from "@/lib/blog"
import { absoluteUrl } from "@/lib/seo"

const marketingRoutes = [
  "/",
  "/funkcije",
  "/cene",
  "/za-agencije",
  "/blog",
  "/kontakt",
  "/uslovi-koriscenja",
  "/politika-privatnosti",
]

export default function sitemap(): MetadataRoute.Sitemap {
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

  return [...staticRoutes, ...blogRoutes]
}
