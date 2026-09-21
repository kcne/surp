/**
 * Locales the product ships, mirroring `ui/i18n/locales.ts`.
 *
 * The API needs these only to keep tenant slugs out of the way of the URL
 * segments the frontend routes on. It owns no language state otherwise: there
 * is no preference column, no preferences endpoint, and no language in any
 * response.
 */
export const SUPPORTED_LOCALES = ['sr', 'en'] as const;
