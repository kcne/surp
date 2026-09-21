import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { DEFAULT_LOCALE, type SupportedLocale } from "@/i18n/locales"
import { negotiateLocale } from "@/i18n/negotiate"
import {
  LOCALE_COOKIE_NAME,
  localeFromCookie,
  localizePathname,
  splitLocaleSegment,
} from "@/i18n/routing"

/**
 * Routes only staff reach. Their pages must never enter a search index, and
 * the prefixes are matched against the path with any locale segment already
 * removed, so `/en/dashboard` is as private as `/dashboard`.
 */
export const PRIVATE_ROUTE_PREFIXES = [
  "/agency-management",
  "/analytics",
  "/dashboard",
  "/lines",
  "/login",
  "/passenger-lists",
  "/passengers",
  "/reservations",
  "/sandbox-demo",
  "/schedule",
  "/settings",
  "/stations",
  "/storefront",
  "/superadmin",
  "/tickets",
] as const

/**
 * Language routing for every page request.
 *
 * The URL decides the language on every path but one. `/` is the single
 * exception: it has no locale segment to read, so it looks at the saved
 * cookie, then the browser's preferences, then falls back to Serbian.
 *
 * Nothing here touches the database, and nothing here writes the language
 * cookie — following a link must not change what a reader saved.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const { segment, rest } = splitLocaleSegment(pathname)

  // `/sr/...` is a valid way to ask for Serbian, but not the canonical URL
  // for it. Redirect permanently so the same page is never indexed twice.
  // `rest` has the segment removed, so this cannot redirect to itself.
  if (segment === DEFAULT_LOCALE) {
    return NextResponse.redirect(new URL(`${rest}${search}`, request.url), 308)
  }

  if (pathname === "/") {
    return handleRoot(request)
  }

  // An `/en/...` path already names the segment of the tree that serves it,
  // so it passes through untouched. Only Serbian, which carries no segment
  // in its URLs, needs the rewrite that puts it under `app/[locale]`.
  if (segment) {
    return decorate(NextResponse.next(), rest)
  }

  return rewrite(request, DEFAULT_LOCALE, pathname)
}

/**
 * The home page, and the only URL whose language depends on the visitor.
 *
 * A saved preference wins over the browser, because it is the one signal the
 * reader set deliberately. English redirects to `/en` rather than rendering
 * English at `/`, so the address bar always names the language being read and
 * the page the reader shares opens the same way for whoever follows it.
 */
function handleRoot(request: NextRequest) {
  const saved = localeFromCookie(request.cookies.get(LOCALE_COOKIE_NAME)?.value)
  const locale =
    saved ?? negotiateLocale(request.headers.get("accept-language")) ?? DEFAULT_LOCALE

  const response =
    locale === DEFAULT_LOCALE
      ? rewrite(request, locale, "/")
      : // Temporary: which language `/` serves depends on who is asking, so a
        // browser must keep asking rather than remember this hop.
        NextResponse.redirect(
          new URL(`${localizePathname(locale, "/")}${request.nextUrl.search}`, request.url),
          307,
        )

  // This one response is visitor-specific. Without both headers a shared
  // cache can hand one reader's language to everybody behind it.
  response.headers.set("Vary", "Accept-Language, Cookie")
  response.headers.set("Cache-Control", "private, no-store")

  return response
}

/**
 * Serve `unprefixed` from the locale's segment of the App Router tree.
 *
 * Serbian URLs carry no segment, so the rewrite is what puts them under
 * `app/[locale]`; the address bar is untouched either way.
 */
function rewrite(request: NextRequest, locale: SupportedLocale, unprefixed: string) {
  const url = request.nextUrl.clone()
  url.pathname = `/${locale}${unprefixed === "/" ? "" : unprefixed}`

  return decorate(NextResponse.rewrite(url), unprefixed)
}

/**
 * Headers that depend on which page is being served rather than on which
 * language serves it, so they apply to rewritten and untouched responses
 * alike. `unprefixed` is the path with any locale segment removed, which is
 * what makes `/en/dashboard` as private as `/dashboard`.
 */
function decorate(response: NextResponse, unprefixed: string) {
  if (isPrivateRoute(unprefixed)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow")
  }

  return response
}

function isPrivateRoute(unprefixed: string): boolean {
  return PRIVATE_ROUTE_PREFIXES.some(
    (prefix) => unprefixed === prefix || unprefixed.startsWith(`${prefix}/`),
  )
}

export const config = {
  // Every page, and nothing else: API routes, Next.js internals, the
  // Markdown and `llms.txt` routes, and any file with an extension are
  // served from outside the locale tree and must not be rewritten into it.
  matcher: ["/((?!api/|_next/|md/|.*\\.).*)"],
}
