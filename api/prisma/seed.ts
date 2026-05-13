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
  const testAgencySlug = 'test-agency';
  const platformTenantSlug = 'platform';
  const adminUsername = 'demo-admin';
  const adminPassword = 'demo-admin-pass';
  const testAgencyAdminUsername = 'test-agency-admin';
  const testAgencyAdminPassword = 'test-agency-admin-pass';
  const inactiveUsername = 'demo-inactive';
  const superadminUsername = 'platform-superadmin';
  const superadminPassword = 'platform-superadmin-pass';

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

  const platformTenant = await prisma.tenant.upsert({
    where: { slug: platformTenantSlug },
    update: {
      name: 'Platform Tenant',
      isActive: true,
      deactivatedAt: null,
      deactivatedById: null
    },
    create: {
      slug: platformTenantSlug,
      name: 'Platform Tenant',
      isActive: true,
      deactivatedAt: null,
      deactivatedById: null
    }
  });

  const testAgencyTenant = await prisma.tenant.upsert({
    where: { slug: testAgencySlug },
    update: {
      name: 'Test Agency',
      timezone: 'Europe/Belgrade',
      isActive: true
    },
    create: {
      slug: testAgencySlug,
      name: 'Test Agency',
      timezone: 'Europe/Belgrade',
      isActive: true
    }
  });

  const adminPasswordHash = await hash(adminPassword, 10);
  const testAgencyAdminPasswordHash = await hash(testAgencyAdminPassword, 10);
  const inactivePasswordHash = await hash('demo-inactive-pass', 10);
  const superadminPasswordHash = await hash(superadminPassword, 10);

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

  await prisma.user.upsert({
    where: {
      tenantId_username: {
        tenantId: testAgencyTenant.id,
        username: testAgencyAdminUsername
      }
    },
    update: {
      email: 'admin@test-agency.local',
      passwordHash: testAgencyAdminPasswordHash,
      role: 'ADMIN',
      isActive: true
    },
    create: {
      tenantId: testAgencyTenant.id,
      username: testAgencyAdminUsername,
      email: 'admin@test-agency.local',
      passwordHash: testAgencyAdminPasswordHash,
      role: 'ADMIN',
      isActive: true
    }
  });

  await prisma.agencyStorefront.upsert({
    where: {
      tenantId: testAgencyTenant.id
    },
    update: {
      status: 'DRAFT',
      heroTitle: 'Test Agency',
      heroSubtitle: 'Comfortable rides across the region',
      aboutMarkdown: '## About Test Agency\n\nPublish this storefront from the dashboard to preview the public page.',
      footerText: 'Safe, reliable, and on time.',
      primaryColor: '#1D4ED8',
      seoTitle: 'Test Agency rides',
      seoDescription: 'Public storefront for Test Agency.'
    },
    create: {
      tenantId: testAgencyTenant.id,
      status: 'DRAFT',
      heroTitle: 'Test Agency',
      heroSubtitle: 'Comfortable rides across the region',
      aboutMarkdown: '## About Test Agency\n\nPublish this storefront from the dashboard to preview the public page.',
      footerText: 'Safe, reliable, and on time.',
      primaryColor: '#1D4ED8',
      seoTitle: 'Test Agency rides',
      seoDescription: 'Public storefront for Test Agency.'
    }
  });

  await prisma.user.upsert({
    where: {
      tenantId_username: {
        tenantId: platformTenant.id,
        username: superadminUsername
      }
    },
    update: {
      email: 'platform.superadmin@demo.local',
      passwordHash: superadminPasswordHash,
      role: 'SUPERADMIN',
      isActive: true
    },
    create: {
      tenantId: platformTenant.id,
      username: superadminUsername,
      email: 'platform.superadmin@demo.local',
      passwordHash: superadminPasswordHash,
      role: 'SUPERADMIN',
      isActive: true
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
      name: 'Seed Referenced Station - Seed Main Station',
      departureStationId: 'seed-station-referenced',
      arrivalStationId: 'seed-station-main',
      directionMode: 'SINGLE',
      direction: 'OUTBOUND',
      pairKey: null,
      isActive: true,
      createdById: adminUser.id,
      updatedById: adminUser.id
    },
    create: {
      id: 'seed-line-referencing-station',
      tenantId: tenant.id,
      name: 'Seed Referenced Station - Seed Main Station',
      departureStationId: 'seed-station-referenced',
      arrivalStationId: 'seed-station-main',
      directionMode: 'SINGLE',
      direction: 'OUTBOUND',
      pairKey: null,
      isActive: true,
      createdById: adminUser.id,
      updatedById: adminUser.id
    }
  });

  await prisma.ride.upsert({
    where: {
      id: 'seed-ride-referencing-line'
    },
    update: {
      tenantId: tenant.id,
      lineId: 'seed-line-referencing-station',
      name: 'Seed Ride Referencing Line',
      capacity: 40,
      type: 'RECURRING',
      status: 'ACTIVE',
      recurringStartDate: new Date('2026-03-01T00:00:00.000Z'),
      recurringEndDate: null,
      oneTimeDate: null,
      oneTimeDepartureTime: null,
      oneTimeArrivalTime: null,
      createdById: adminUser.id,
      updatedById: adminUser.id
    },
    create: {
      id: 'seed-ride-referencing-line',
      tenantId: tenant.id,
      lineId: 'seed-line-referencing-station',
      name: 'Seed Ride Referencing Line',
      capacity: 40,
      type: 'RECURRING',
      status: 'ACTIVE',
      recurringStartDate: new Date('2026-03-01T00:00:00.000Z'),
      recurringEndDate: null,
      oneTimeDate: null,
      oneTimeDepartureTime: null,
      oneTimeArrivalTime: null,
      createdById: adminUser.id,
      updatedById: adminUser.id
    }
  });

  await prisma.passenger.upsert({
    where: {
      id: 'seed-passenger-active'
    },
    update: {
      tenantId: tenant.id,
      firstName: 'Mila',
      lastName: 'Markovic',
      phone: '+381640000111',
      email: 'mila.markovic@demo.local',
      passengerType: 'ADULT',
      isActive: true,
      notes: 'Seed active passenger',
      createdById: adminUser.id,
      updatedById: adminUser.id
    },
    create: {
      id: 'seed-passenger-active',
      tenantId: tenant.id,
      firstName: 'Mila',
      lastName: 'Markovic',
      phone: '+381640000111',
      email: 'mila.markovic@demo.local',
      passengerType: 'ADULT',
      isActive: true,
      notes: 'Seed active passenger',
      createdById: adminUser.id,
      updatedById: adminUser.id
    }
  });

  await prisma.passenger.upsert({
    where: {
      id: 'seed-passenger-inactive'
    },
    update: {
      tenantId: tenant.id,
      firstName: 'Nikola',
      lastName: 'Ilic',
      phone: '+381640000222',
      email: 'nikola.ilic@demo.local',
      passengerType: 'STUDENT',
      isActive: false,
      notes: 'Seed inactive passenger',
      createdById: adminUser.id,
      updatedById: adminUser.id
    },
    create: {
      id: 'seed-passenger-inactive',
      tenantId: tenant.id,
      firstName: 'Nikola',
      lastName: 'Ilic',
      phone: '+381640000222',
      email: 'nikola.ilic@demo.local',
      passengerType: 'STUDENT',
      isActive: false,
      notes: 'Seed inactive passenger',
      createdById: adminUser.id,
      updatedById: adminUser.id
    }
  });

  await prisma.reservation.upsert({
    where: {
      id: 'seed-reservation-referencing-station'
    },
    update: {
      tenantId: tenant.id,
      rideId: 'seed-ride-referencing-line',
      passengerId: 'seed-passenger-active',
      departureStationId: 'seed-station-referenced',
      arrivalStationId: 'seed-station-main',
      travelDate: new Date('2026-03-30T00:00:00.000Z'),
      rideDepartureTime: '09:00',
      rideArrivalTime: '10:00',
      seatNumber: 1,
      status: 'ACTIVE',
      cancelledAt: null,
      createdById: adminUser.id,
      updatedById: adminUser.id
    },
    create: {
      id: 'seed-reservation-referencing-station',
      tenantId: tenant.id,
      rideId: 'seed-ride-referencing-line',
      passengerId: 'seed-passenger-active',
      departureStationId: 'seed-station-referenced',
      arrivalStationId: 'seed-station-main',
      travelDate: new Date('2026-03-30T00:00:00.000Z'),
      rideDepartureTime: '09:00',
      rideArrivalTime: '10:00',
      seatNumber: 1,
      status: 'ACTIVE',
      cancelledAt: null,
      createdById: adminUser.id,
      updatedById: adminUser.id
    }
  });

  console.log('Seeded tenant, users, stations, lines, and passengers fixtures.');
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
