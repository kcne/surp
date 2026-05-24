"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { landingPages } from "@/lib/landing-pages"

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

export function SeoPageAnalytics() {
  const pathname = usePathname()

  useEffect(() => {
    const landingPage = landingPages.find((page) => pathname === `/${page.slug}`)

    if (!landingPage || !window.gtag) {
      return
    }

    window.gtag("event", "seo_page_view", {
      landing_type: "bofu_landing",
      pillar: landingPage.pillar,
      intent_stage: landingPage.intentStage,
      page_path: pathname,
    })
  }, [pathname])

  return null
}
