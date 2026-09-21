import { CheckResult, Invariant, InvariantContext } from '../invariant.types';
import { RESERVED_TENANT_SLUGS } from '../../platform-tenants/reserved-slugs';

/**
 * A tenant's storefront must be reachable at its own slug.
 *
 * Storefronts live at the root of the site, so a slug that matches one of the
 * application's own path segments never reaches the storefront: the other
 * route matches first. Slug validation refuses these at creation and at lead
 * conversion, but that only protects tenants created after the word was
 * reserved. Adding a locale — `/en`, and `/sr` for the canonical redirect —
 * reserves two new words against a table that already has rows in it, and
 * this is what finds the rows.
 *
 * Read-only on purpose. A storefront URL an agency has printed on a ticket or
 * linked from its own site is not ours to rewrite, so this reports and stops;
 * the fix is a conversation with the agency, not a migration.
 */
export async function checkTenantSlugReserved(ctx: InvariantContext): Promise<CheckResult> {
  const tenant = await ctx.prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { id: true, slug: true, name: true }
  });

  // A run for a tenant that no longer exists has nothing to check; the
  // orphaned-data checks are what speak to that.
  if (!tenant) {
    return { scannedCount: 0, violations: [] };
  }

  const slug = tenant.slug.trim().toLowerCase();
  if (!RESERVED_TENANT_SLUGS.has(slug)) {
    return { scannedCount: 1, violations: [] };
  }

  return {
    scannedCount: 1,
    violations: [
      {
        subjectType: 'system',
        subjectId: tenant.id,
        summary: `Javni izlog agencije "${tenant.name}" koristi rezervisanu adresu "/${tenant.slug}" i zato nije dostupan.`,
        detail: {
          tenantId: tenant.id,
          tenantName: tenant.name,
          slug: tenant.slug,
          storefrontPath: `/${tenant.slug}`
        },
        canRepair: false
      }
    ]
  };
}

export const tenantSlugReserved: Invariant = {
  key: 'tenant.slug-reserved',
  title: 'Adresa javnog izloga nije rezervisana reč',
  description:
    'Javni izlog agencije nalazi se na početku adrese sajta, pa adresa koja se poklapa sa putanjom same aplikacije nikada ne otvori izlog — otvori se ta druga stranica.',
  manualAdvice:
    'Dogovorite sa agencijom novu adresu izloga i promenite je ručno u podešavanjima agencije. Adresa se ne menja automatski jer je agencija možda već odštampala ili objavila postojeći link, pa stari link treba da bude preusmeren.',
  severity: 'warning',
  async check(ctx: InvariantContext): Promise<CheckResult> {
    return checkTenantSlugReserved(ctx);
  }
};
