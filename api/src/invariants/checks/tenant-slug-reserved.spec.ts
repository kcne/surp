import { checkTenantSlugReserved } from './tenant-slug-reserved';
import { InvariantContext } from '../invariant.types';

function contextFor(tenant: { id: string; slug: string; name: string } | null): InvariantContext {
  return {
    tenantId: 'tenant-1',
    actorId: 'actor-1',
    windowDays: 30,
    prisma: {
      tenant: { findUnique: async () => tenant }
    } as unknown as InvariantContext['prisma']
  };
}

describe('tenant.slug-reserved', () => {
  it('is clean for an ordinary agency slug', async () => {
    const result = await checkTenantSlugReserved(
      contextFor({ id: 'tenant-1', slug: 'lasta-beograd', name: 'Lasta' })
    );

    expect(result).toEqual({ scannedCount: 1, violations: [] });
  });

  it('reports a slug that collides with a locale segment', async () => {
    const result = await checkTenantSlugReserved(
      contextFor({ id: 'tenant-1', slug: 'en', name: 'Euronet' })
    );

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      subjectType: 'system',
      subjectId: 'tenant-1',
      canRepair: false,
      detail: { slug: 'en', storefrontPath: '/en', tenantName: 'Euronet' }
    });
  });

  it('reports the Serbian segment too, which only ever redirects', async () => {
    const result = await checkTenantSlugReserved(
      contextFor({ id: 'tenant-1', slug: 'sr', name: 'Srbija tours' })
    );

    expect(result.violations).toHaveLength(1);
  });

  it('reports a slug reserved before locales existed', async () => {
    const result = await checkTenantSlugReserved(
      contextFor({ id: 'tenant-1', slug: 'blog', name: 'Blog Travel' })
    );

    expect(result.violations).toHaveLength(1);
  });

  it('matches case and surrounding whitespace the way slug validation does', async () => {
    const result = await checkTenantSlugReserved(
      contextFor({ id: 'tenant-1', slug: ' EN ', name: 'Euronet' })
    );

    expect(result.violations).toHaveLength(1);
  });

  // A slug that starts with a locale is not a locale: only a whole segment is
  // consumed by language routing, so `/srbija-tours` still reaches its
  // storefront.
  it('leaves a slug that merely starts with a locale alone', async () => {
    const result = await checkTenantSlugReserved(
      contextFor({ id: 'tenant-1', slug: 'srbija-tours', name: 'Srbija tours' })
    );

    expect(result.violations).toEqual([]);
  });

  it('never offers to repair, because a published storefront URL is not ours to change', async () => {
    const result = await checkTenantSlugReserved(
      contextFor({ id: 'tenant-1', slug: 'en', name: 'Euronet' })
    );

    expect(result.violations[0].canRepair).toBe(false);
  });

  it('scans nothing when the tenant has gone', async () => {
    const result = await checkTenantSlugReserved(contextFor(null));

    expect(result).toEqual({ scannedCount: 0, violations: [] });
  });
});
