import { Prisma, StorefrontStatus } from '@prisma/client';
import { DEFAULT_STOREFRONT_SECTIONS, StorefrontSections } from './storefront.constants';
import {
  PublicAgencyStorefrontResponseDto,
  PublicStorefrontRideSummaryDto,
  StorefrontAdminResponseDto,
  StorefrontSectionsDto
} from './dto/storefront.response.dto';

export const STOREFRONT_SELECT = Prisma.validator<Prisma.AgencyStorefrontSelect>()({
  tenantId: true,
  status: true,
  publishedAt: true,
  heroTitle: true,
  heroSubtitle: true,
  heroImageUrl: true,
  heroImageAlt: true,
  aboutMarkdown: true,
  footerText: true,
  logoUrl: true,
  logoAlt: true,
  rideIconUrl: true,
  rideIconStorageKey: true,
  primaryColor: true,
  sectionsEnabled: true,
  seoTitle: true,
  seoDescription: true,
  ogImageUrl: true,
  facebookUrl: true,
  instagramUrl: true,
  twitterUrl: true,
  linkedinUrl: true,
  websiteUrl: true,
  updatedAt: true,
  tenant: {
    select: {
      slug: true,
      name: true,
      timezone: true
    }
  }
});

export type SelectedStorefront = Prisma.AgencyStorefrontGetPayload<{ select: typeof STOREFRONT_SELECT }>;

export function mapStorefrontToPublicDto(
  storefront: SelectedStorefront,
  rides: PublicStorefrontRideSummaryDto[] = []
): PublicAgencyStorefrontResponseDto {
  return {
    ...mapCommonStorefrontFields(storefront),
    slug: storefront.tenant.slug,
    name: storefront.tenant.name,
    timezone: storefront.tenant.timezone,
    rides
  };
}

export function mapStorefrontToAdminDto(
  storefront: SelectedStorefront
): StorefrontAdminResponseDto {
  return {
    ...mapCommonStorefrontFields(storefront),
    tenantId: storefront.tenantId,
    tenantSlug: storefront.tenant.slug,
    tenantName: storefront.tenant.name
  };
}

export function buildDraftStorefrontDto(tenant: {
  id: string;
  slug: string;
  name: string;
  timezone: string | null;
}): StorefrontAdminResponseDto {
  return {
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    tenantName: tenant.name,
    status: StorefrontStatus.DRAFT,
    publishedAt: null,
    heroTitle: null,
    heroSubtitle: null,
    heroImageUrl: null,
    heroImageAlt: null,
    aboutMarkdown: null,
    footerText: null,
    logoUrl: null,
    logoAlt: null,
    rideIconUrl: null,
    primaryColor: null,
    sectionsEnabled: { ...DEFAULT_STOREFRONT_SECTIONS },
    seoTitle: null,
    seoDescription: null,
    ogImageUrl: null,
    socialLinks: {
      facebookUrl: null,
      instagramUrl: null,
      twitterUrl: null,
      linkedinUrl: null,
      websiteUrl: null
    },
    updatedAt: new Date(0)
  };
}

function mapCommonStorefrontFields(storefront: SelectedStorefront) {
  return {
    status: storefront.status,
    publishedAt: storefront.publishedAt,
    heroTitle: storefront.heroTitle,
    heroSubtitle: storefront.heroSubtitle,
    heroImageUrl: storefront.heroImageUrl,
    heroImageAlt: storefront.heroImageAlt,
    aboutMarkdown: storefront.aboutMarkdown,
    footerText: storefront.footerText,
    logoUrl: storefront.logoUrl,
    logoAlt: storefront.logoAlt,
    rideIconUrl: resolveRideIconUrl(storefront),
    primaryColor: storefront.primaryColor,
    sectionsEnabled: normalizeSections(storefront.sectionsEnabled),
    seoTitle: storefront.seoTitle,
    seoDescription: storefront.seoDescription,
    ogImageUrl: storefront.ogImageUrl,
    socialLinks: {
      facebookUrl: storefront.facebookUrl,
      instagramUrl: storefront.instagramUrl,
      twitterUrl: storefront.twitterUrl,
      linkedinUrl: storefront.linkedinUrl,
      websiteUrl: storefront.websiteUrl
    },
    updatedAt: storefront.updatedAt
  };
}

function resolveRideIconUrl(storefront: SelectedStorefront): string | null {
  if (storefront.rideIconStorageKey) {
    return `/api/public/agencies/${encodeURIComponent(storefront.tenant.slug)}/assets/ride-icon`;
  }

  return storefront.rideIconUrl;
}

export function normalizeSections(value: Prisma.JsonValue): StorefrontSectionsDto {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_STOREFRONT_SECTIONS };
  }

  const record = value as Record<string, unknown>;
  return {
    hero: typeof record.hero === 'boolean' ? record.hero : DEFAULT_STOREFRONT_SECTIONS.hero,
    rides: typeof record.rides === 'boolean' ? record.rides : DEFAULT_STOREFRONT_SECTIONS.rides,
    about: typeof record.about === 'boolean' ? record.about : DEFAULT_STOREFRONT_SECTIONS.about
  };
}

export function normalizeSectionsInput(value: Partial<StorefrontSections> | undefined): StorefrontSections {
  return {
    hero: value?.hero ?? DEFAULT_STOREFRONT_SECTIONS.hero,
    rides: value?.rides ?? DEFAULT_STOREFRONT_SECTIONS.rides,
    about: value?.about ?? DEFAULT_STOREFRONT_SECTIONS.about
  };
}
