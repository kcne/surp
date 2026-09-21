import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"

import { middleware } from "@/middleware"

const ORIGIN = "https://surp.rs"

function request(
  path: string,
  init: { acceptLanguage?: string; cookie?: string } = {},
): NextRequest {
  const headers = new Headers()
  if (init.acceptLanguage !== undefined) headers.set("accept-language", init.acceptLanguage)
  if (init.cookie !== undefined) headers.set("cookie", `NEXT_LOCALE=${init.cookie}`)

  return new NextRequest(new URL(path, ORIGIN), { headers })
}

/** Where the response actually sends or renders from, whichever it does. */
function destination(response: Response): {
  status: number
  location: string | null
  rewrite: string | null
} {
  const rewrite = response.headers.get("x-middleware-rewrite")

  return {
    status: response.status,
    location: response.headers.get("location"),
    rewrite: rewrite ? new URL(rewrite).pathname + new URL(rewrite).search : null,
  }
}

function pathOf(location: string | null): string | null {
  if (!location) return null
  const url = new URL(location, ORIGIN)
  return url.pathname + url.search
}

describe("language routing", () => {
  describe("the home page, the one URL whose language depends on the visitor", () => {
    it("serves Serbian when nothing is known about the reader", () => {
      const { status, rewrite } = destination(middleware(request("/")))

      expect(status).toBe(200)
      expect(rewrite).toBe("/sr")
    })

    it("redirects to /en when the browser asks for English", () => {
      const result = destination(middleware(request("/", { acceptLanguage: "en-GB,en;q=0.9" })))

      expect(result.status).toBe(307)
      expect(pathOf(result.location)).toBe("/en")
    })

    it("respects browser weights rather than list order", () => {
      const result = destination(middleware(request("/", { acceptLanguage: "sr;q=0.2, en;q=0.9" })))

      expect(pathOf(result.location)).toBe("/en")
    })

    it("ignores a language the reader rejected", () => {
      const { status } = destination(middleware(request("/", { acceptLanguage: "en;q=0, sr;q=0.1" })))

      expect(status).toBe(200)
    })

    it("falls back to Serbian for a language the product does not ship", () => {
      const { status, rewrite } = destination(
        middleware(request("/", { acceptLanguage: "de-DE,de;q=0.9" })),
      )

      expect(status).toBe(200)
      expect(rewrite).toBe("/sr")
    })

    it("lets a saved preference beat the browser, in both directions", () => {
      const toEnglish = destination(
        middleware(request("/", { acceptLanguage: "sr", cookie: "en" })),
      )
      expect(pathOf(toEnglish.location)).toBe("/en")

      const toSerbian = destination(
        middleware(request("/", { acceptLanguage: "en-US", cookie: "sr" })),
      )
      expect(toSerbian.status).toBe(200)
      expect(toSerbian.rewrite).toBe("/sr")
    })

    it("ignores a cookie holding a value the registry does not know", () => {
      const result = destination(
        middleware(request("/", { acceptLanguage: "en-US", cookie: "de" })),
      )

      // The stale cookie is discarded and the browser decides.
      expect(pathOf(result.location)).toBe("/en")
    })

    it("keeps the query string across the redirect", () => {
      const result = destination(
        middleware(request("/?utm_source=x&b=2", { acceptLanguage: "en" })),
      )

      expect(pathOf(result.location)).toBe("/en?utm_source=x&b=2")
    })

    it("redirects temporarily, because the answer is per visitor", () => {
      const response = middleware(request("/", { acceptLanguage: "en" }))

      // A permanent redirect would be cached by the browser and would then
      // send this reader to English even after they switch language.
      expect(response.status).toBe(307)
    })

    it("marks both answers as unusable by a shared cache", () => {
      for (const acceptLanguage of ["en", "sr"]) {
        const response = middleware(request("/", { acceptLanguage }))

        // Without these a CDN can hand one visitor's language to everyone
        // behind it.
        expect(response.headers.get("Vary")).toBe("Accept-Language, Cookie")
        expect(response.headers.get("Cache-Control")).toBe("private, no-store")
      }
    })

    it("never writes the language cookie: following a link is not a choice", () => {
      const response = middleware(request("/", { acceptLanguage: "en" }))

      expect(response.headers.get("set-cookie")).toBeNull()
    })
  })

  describe("every other URL states its own language", () => {
    it("serves an unprefixed page in Serbian whatever the reader saved", () => {
      const result = destination(
        middleware(request("/cene", { cookie: "en", acceptLanguage: "en-US" })),
      )

      // The link a Serbian reader shares must open in Serbian for everyone.
      expect(result.status).toBe(200)
      expect(result.location).toBeNull()
      expect(result.rewrite).toBe("/sr/cene")
    })

    it("serves a prefixed page in English without touching the URL", () => {
      const result = destination(middleware(request("/en/cene", { cookie: "sr" })))

      expect(result.status).toBe(200)
      expect(result.location).toBeNull()
      // Already the path that serves it; rewriting it would be a no-op.
      expect(result.rewrite).toBeNull()
    })

    it("keeps the query string on a rewritten Serbian page", () => {
      const result = destination(middleware(request("/reservations?date=2026-09-21")))

      expect(result.rewrite).toBe("/sr/reservations?date=2026-09-21")
    })

    it("routes a storefront slug that starts with a locale to the storefront", () => {
      const result = destination(middleware(request("/srbija-tours")))

      expect(result.rewrite).toBe("/sr/srbija-tours")
    })
  })

  describe("/sr is accepted but never canonical", () => {
    it("redirects /sr to the unprefixed home page", () => {
      const result = destination(middleware(request("/sr")))

      expect(result.status).toBe(308)
      expect(pathOf(result.location)).toBe("/")
    })

    it("redirects a nested /sr path to its unprefixed equivalent", () => {
      const result = destination(middleware(request("/sr/blog/neki-post")))

      expect(pathOf(result.location)).toBe("/blog/neki-post")
    })

    it("keeps the query string", () => {
      const result = destination(middleware(request("/sr/reservations?date=2026-09-21")))

      expect(pathOf(result.location)).toBe("/reservations?date=2026-09-21")
    })

    it("terminates instead of looping on a repeated segment", () => {
      // One segment is consumed per hop, so `/sr/sr` reaches `/` in two.
      const first = destination(middleware(request("/sr/sr")))
      expect(pathOf(first.location)).toBe("/sr")

      const second = destination(middleware(request("/sr")))
      expect(pathOf(second.location)).toBe("/")

      expect(destination(middleware(request("/"))).status).toBe(200)
    })

    it("leaves /en alone, so the two prefixes cannot redirect at each other", () => {
      expect(destination(middleware(request("/en"))).status).toBe(200)
      expect(destination(middleware(request("/en"))).location).toBeNull()
    })
  })

  describe("private pages stay out of search results in both languages", () => {
    const privatePaths = [
      "/dashboard",
      "/reservations/abc",
      "/settings",
      "/settings/data-integrity",
      "/superadmin",
      "/superadmin/agencies/1",
      "/login",
    ]

    it.each(privatePaths)("marks %s noindex", (path) => {
      expect(middleware(request(path)).headers.get("X-Robots-Tag")).toBe("noindex, nofollow")
    })

    it.each(privatePaths)("marks /en%s noindex too", (path) => {
      expect(middleware(request(`/en${path}`)).headers.get("X-Robots-Tag")).toBe(
        "noindex, nofollow",
      )
    })

    it("leaves public pages indexable in both languages", () => {
      for (const path of ["/", "/cene", "/blog", "/srbija-tours", "/en/cene", "/en"]) {
        expect(middleware(request(path)).headers.get("X-Robots-Tag")).toBeNull()
      }
    })

    it("does not mark a public page whose slug merely starts with a private prefix", () => {
      // `/login-servis` would be an agency, not the staff login page.
      expect(middleware(request("/login-servis")).headers.get("X-Robots-Tag")).toBeNull()
    })
  })
})
