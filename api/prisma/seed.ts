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
  } else {
    console.log('Baseline seed record already exists.');
  }

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

  const adminUser = await prisma.user.upsert({
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

  await prisma.station.upsert({
    where: {
      id: 'seed-station-main'
    },
    update: {
      tenantId: tenant.id,
      name: 'Seed Main Station',
      address: '100 Seed Avenue, Demo City',
      category: 'BUS_STATION',
      isActive: true,
      createdById: adminUser.id,
      updatedById: adminUser.id
    },
    create: {
      id: 'seed-station-main',
      tenantId: tenant.id,
      name: 'Seed Main Station',
      address: '100 Seed Avenue, Demo City',
      category: 'BUS_STATION',
      isActive: true,
      createdById: adminUser.id,
      updatedById: adminUser.id
    }
  });

  await prisma.station.upsert({
    where: {
      id: 'seed-station-referenced'
    },
    update: {
      tenantId: tenant.id,
      name: 'Seed Referenced Station',
      address: '200 Seed Avenue, Demo City',
      category: 'BUS_STOP',
      isActive: true,
      createdById: adminUser.id,
      updatedById: adminUser.id
    },
    create: {
      id: 'seed-station-referenced',
      tenantId: tenant.id,
      name: 'Seed Referenced Station',
      address: '200 Seed Avenue, Demo City',
      category: 'BUS_STOP',
      isActive: true,
      createdById: adminUser.id,
      updatedById: adminUser.id
    }
  });

  await prisma.line.upsert({
    where: {
      id: 'seed-line-referencing-station'
    },
    update: {
      tenantId: tenant.id,
      departureStationId: 'seed-station-referenced',
      arrivalStationId: 'seed-station-main'
    },
    create: {
      id: 'seed-line-referencing-station',
      tenantId: tenant.id,
      departureStationId: 'seed-station-referenced',
      arrivalStationId: 'seed-station-main'
    }
  });

  await prisma.reservation.upsert({
    where: {
      id: 'seed-reservation-referencing-station'
    },
    update: {
      tenantId: tenant.id,
      departureStationId: 'seed-station-referenced',
      arrivalStationId: 'seed-station-main'
    },
    create: {
      id: 'seed-reservation-referencing-station',
      tenantId: tenant.id,
      departureStationId: 'seed-station-referenced',
      arrivalStationId: 'seed-station-main'
    }
  });

  console.log('Seeded tenant, users, and stations fixtures for Slice 8 scenarios.');
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
