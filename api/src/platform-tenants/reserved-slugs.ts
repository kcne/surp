import { SUPPORTED_LOCALES } from './supported-locales';

/**
 * Slugs a tenant may not take, because a URL is already using them.
 *
 * A tenant's storefront lives at the root of the site — `/moja-agencija` — so
 * every slug competes with the application's own paths. Taking one would not
 * produce an error: the other route would simply win and the agency's
 * storefront would become unreachable.
 */
export const RESERVED_TENANT_SLUGS = new Set([
  'login',
  'signup',
  'forgot-password',
  'verify',
  'api',
  'admin',
  'blog',
  'agencies',
  '_next',
  'sitemap.xml',
  'robots.txt',
  'health',
  'dashboard',
  'auth',
  // Language segments. `/en/...` selects English and `/sr/...` redirects to
  // the unprefixed Serbian path, so both are consumed before any storefront
  // lookup happens. Every locale added to the registry has to be added here,
  // and `tenant.slug-reserved` reports tenants that already hold the new
  // word — no slug is ever changed automatically, because a storefront URL
  // an agency has printed and linked is not ours to rewrite.
  ...SUPPORTED_LOCALES
]);
