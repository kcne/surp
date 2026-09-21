/**
 * Next 14 resolves a `not-found.tsx` next to the route that called
 * `notFound()`, not from an ancestor segment, so each such route gets its
 * own boundary file. The body is shared.
 */
export { StorefrontNotFound as default } from "@/components/errors/storefront-not-found"
