import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const baselineMessage = 'baseline-seed';

  const existingBaseline = await prisma.healthCheckLog.findFirst({
    where: {
      message: baselineMessage
    }
  });

  if (!existingBaseline) {
    await prisma.healthCheckLog.create({
      data: {
        message: baselineMessage
      }
    });
    console.log('Inserted baseline seed record.');
    return;
  }

  console.log('Baseline seed record already exists.');

  const tenantSlug = 'demo-tenant';
  const adminUsername = 'demo-admin';
  const adminPassword = 'demo-admin-pass';
  const inactiveUsername = 'demo-inactive';

  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    update: {
      name: 'Demo Tenant',
      isActive: true
    },
    create: {
      slug: tenantSlug,
      name: 'Demo Tenant',
      isActive: true
    }
  });

  const adminPasswordHash = await hash(adminPassword, 10);
  const inactivePasswordHash = await hash('demo-inactive-pass', 10);

  await prisma.user.upsert({
    where: {
      tenantId_username: {
        tenantId: tenant.id,
        username: adminUsername
      }
    },
    update: {
      email: 'admin@demo.local',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      isActive: true
    },
    create: {
      tenantId: tenant.id,
      username: adminUsername,
      email: 'admin@demo.local',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      isActive: true
    }
  });

  await prisma.user.upsert({
    where: {
      tenantId_username: {
        tenantId: tenant.id,
        username: inactiveUsername
      }
    },
    update: {
      email: 'inactive@demo.local',
      passwordHash: inactivePasswordHash,
      role: 'STAFF',
      isActive: false
    },
    create: {
      tenantId: tenant.id,
      username: inactiveUsername,
      email: 'inactive@demo.local',
      passwordHash: inactivePasswordHash,
      role: 'STAFF',
      isActive: false
    }
  });

  console.log('Seeded tenant and users for Slice 3 login scenarios.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
