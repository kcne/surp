import type { MetadataRoute } from "next"
import { absoluteUrl } from "@/lib/seo"

export default function robots(): MetadataRoute.Robots {
  const isProduction = process.env.NODE_ENV === "production"

  if (!isProduction) {
    return {
      rules: [
        {
          userAgent: "*",
          disallow: "/",
        },
      ],
      sitemap: absoluteUrl("/sitemap.xml"),
    }
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/agency-management",
          "/analytics",
          "/dashboard",
          "/lines",
          "/login",
          "/passengers",
          "/reservations",
          "/schedule",
          "/stations",
          "/storefront",
          "/tickets",
          "/api",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  }
}
