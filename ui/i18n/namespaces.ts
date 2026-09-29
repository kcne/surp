/**
 * Message catalogs are split by stable product domain rather than by page, so
 * a page can be restructured without moving its strings between files.
 */
export const MESSAGE_NAMESPACES = [
  "common",
  "auth",
  "dashboard",
  "reservations",
  "passengers",
  "schedules",
  "storefront",
  "marketing",
  "superAdmin",
  "errors",
  "exports",
] as const

export type MessageNamespace = (typeof MESSAGE_NAMESPACES)[number]

/**
 * Namespaces every client component may rely on, shipped from the root
 * layout. Everything else is passed down by the route that needs it, so a
 * reservations page does not send marketing copy to the browser.
 */
export const ROOT_NAMESPACES = ["common", "errors"] as const satisfies readonly MessageNamespace[]
