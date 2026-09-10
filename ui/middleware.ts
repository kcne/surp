import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

const privateRoutePrefixes = [
  "/agency-management",
  "/analytics",
  "/dashboard",
  "/lines",
  "/login",
  "/passenger-lists",
  "/passengers",
  "/reservations",
  "/schedule",
  "/stations",
  "/storefront",
  "/superadmin",
  "/tickets",
  "/sandbox-demo",
]

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  if (privateRoutePrefixes.some((prefix) => request.nextUrl.pathname === prefix || request.nextUrl.pathname.startsWith(`${prefix}/`))) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow")
  }

  return response
}

export const config = {
  matcher: [
    "/agency-management/:path*",
    "/analytics/:path*",
    "/dashboard/:path*",
    "/lines/:path*",
    "/login",
    "/sandbox-demo",
    "/passenger-lists/:path*",
    "/passengers/:path*",
    "/reservations/:path*",
    "/schedule/:path*",
    "/stations/:path*",
    "/storefront/:path*",
    "/superadmin/:path*",
    "/tickets/:path*",
  ],
}
