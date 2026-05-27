"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

/**
 * AI-G: prepoznaje posete sa AI search platformi (ChatGPT, Perplexity, Google
 * AI Mode, Claude, Gemini, Copilot...) preko `document.referrer` i salje GA4
 * event `ai_visit` jednom po sesiji + standardni `page_view` event sa
 * `ai_source` dimenzijom za svaku stranicu.
 *
 * Tracking se ne menja u SEO ranking-u; sluzi samo za merenje stvarnog
 * AI saobracaja na sajtu (vidi docs/ai-search-plan.md, Slice AI-G).
 */

type AiSource = {
  source: string
  hostnames: string[]
}

const AI_SOURCES: AiSource[] = [
  { source: "chatgpt", hostnames: ["chatgpt.com", "chat.openai.com"] },
  { source: "perplexity", hostnames: ["perplexity.ai", "www.perplexity.ai"] },
  { source: "gemini", hostnames: ["gemini.google.com"] },
  { source: "claude", hostnames: ["claude.ai"] },
  { source: "copilot", hostnames: ["copilot.microsoft.com"] },
  { source: "google-ai-mode", hostnames: ["www.google.com/search"] },
  { source: "you", hostnames: ["you.com"] },
  { source: "phind", hostnames: ["www.phind.com", "phind.com"] },
  { source: "duckduckgo-ai", hostnames: ["duckduckgo.com/?q="] },
  { source: "brave-leo", hostnames: ["search.brave.com"] },
]

const SESSION_KEY = "surp_ai_visit_logged"

function detectAiSource(referrer: string): string | null {
  if (!referrer) return null
  try {
    const url = new URL(referrer)
    const fullHost = `${url.hostname}${url.pathname}`
    for (const { source, hostnames } of AI_SOURCES) {
      if (hostnames.some((h) => url.hostname === h || fullHost.startsWith(h))) {
        return source
      }
    }
    return null
  } catch {
    return null
  }
}

export function AiReferrerAnalytics() {
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window === "undefined" || !window.gtag) return

    const aiSource = detectAiSource(document.referrer)
    if (!aiSource) return

    // Jednom po sesiji salji glavni "ai_visit" event sa landing path-om.
    let alreadyLogged = false
    try {
      alreadyLogged = sessionStorage.getItem(SESSION_KEY) === aiSource
    } catch {
      // sessionStorage nedostupan (npr. inkognito + restrikcije) — radi se event svakako.
    }

    if (!alreadyLogged) {
      window.gtag("event", "ai_visit", {
        ai_source: aiSource,
        landing_path: pathname,
        referrer: document.referrer,
      })
      try {
        sessionStorage.setItem(SESSION_KEY, aiSource)
      } catch {
        // ignore
      }
    }
  }, [pathname])

  return null
}
