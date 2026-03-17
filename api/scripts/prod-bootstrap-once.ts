import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

const BOOTSTRAP_MARKER = 'prod-bootstrap-superadmin-v1';
const PLATFORM_TENANT_SLUG = 'platform';
const PLATFORM_TENANT_NAME = 'Platform Tenant';

const SUPERADMIN_DEFAULT_USERNAME = 'platform-superadmin';
const SUPERADMIN_DEFAULT_EMAIL = 'platform.superadmin@balbus.rs';

async function main() {
  const alreadyBootstrapped = await prisma.healthCheckLog.findFirst({
    where: { message: BOOTSTRAP_MARKER },
  });

  if (alreadyBootstrapped) {
    console.log(`Bootstrap already applied (${BOOTSTRAP_MARKER}). Skipping.`);
    return;
  }

  const superadminUsername = process.env.BOOTSTRAP_SUPERADMIN_USERNAME?.trim() || SUPERADMIN_DEFAULT_USERNAME;
  const superadminEmail = process.env.BOOTSTRAP_SUPERADMIN_EMAIL?.trim() || SUPERADMIN_DEFAULT_EMAIL;
  const superadminPassword = process.env.BOOTSTRAP_SUPERADMIN_PASSWORD?.trim();

  if (!superadminPassword) {
    throw new Error('BOOTSTRAP_SUPERADMIN_PASSWORD is required.');
  }

  const superadminPasswordHash = await hash(superadminPassword, 10);

  const platformTenant = await prisma.tenant.upsert({
    where: { slug: PLATFORM_TENANT_SLUG },
    update: {
      name: PLATFORM_TENANT_NAME,
      isActive: true,
      deactivatedAt: null,
      deactivatedById: null,
    },
    create: {
      slug: PLATFORM_TENANT_SLUG,
      name: PLATFORM_TENANT_NAME,
      isActive: true,
      deactivatedAt: null,
      deactivatedById: null,
    },
  });

  const superadmin = await prisma.user.upsert({
    where: {
      tenantId_username: {
        tenantId: platformTenant.id,
        username: superadminUsername,
      },
    },
    update: {
      email: superadminEmail,
      passwordHash: superadminPasswordHash,
      role: 'SUPERADMIN',
      isActive: true,
      requirePasswordChange: false,
    },
    create: {
      tenantId: platformTenant.id,
      username: superadminUsername,
      email: superadminEmail,
      passwordHash: superadminPasswordHash,
      role: 'SUPERADMIN',
      isActive: true,
      requirePasswordChange: false,
    },
  });

  await prisma.healthCheckLog.create({
    data: {
      message: BOOTSTRAP_MARKER,
    },
  });

  console.log('Production bootstrap completed.');
  console.log(`Platform tenant: ${PLATFORM_TENANT_SLUG} (${PLATFORM_TENANT_NAME})`);
  console.log(`Superadmin: ${superadminUsername} (${superadminEmail})`);
}

main()
  .catch((error) => {
    console.error('Production bootstrap failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
