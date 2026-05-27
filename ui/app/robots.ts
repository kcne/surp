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

  // AI / generative search crawlers. Explicitly allowed so they can index
  // marketing + storefront content for AI Overviews, ChatGPT, Perplexity,
  // Claude, Gemini, Apple Intelligence, etc. See docs/ai-search-plan.md (AI-A).
  const aiCrawlers = [
    "GPTBot",
    "ChatGPT-User",
    "OAI-SearchBot",
    "ClaudeBot",
    "Claude-Web",
    "anthropic-ai",
    "PerplexityBot",
    "Perplexity-User",
    "Google-Extended",
    "GoogleOther",
    "Applebot",
    "Applebot-Extended",
    "Bytespider",
    "CCBot",
    "cohere-ai",
    "Meta-ExternalAgent",
    "Meta-ExternalFetcher",
    "DuckAssistBot",
    "YouBot",
    "Amazonbot",
    "Bingbot",
  ]

  return {
    rules: [
      {
        userAgent: aiCrawlers,
        allow: "/",
        disallow: ["/api", "/login", "/dashboard", "/superadmin"],
      },
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
