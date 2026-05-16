import type { MetadataRoute } from "next"
import { absoluteUrl } from "@/lib/seo"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/reservations", "/dashboard", "/storefront", "/login", "/auth", "/tickets", "/api"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  }
}
