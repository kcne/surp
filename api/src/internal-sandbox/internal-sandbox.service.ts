import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LineDirection,
  LineDirectionMode,
  PassengerType,
  Prisma,
  ReservationStatus,
  RideStatus,
  RideType,
  StationCategory,
  UserRole
} from '@prisma/client';
import { hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

const SANDBOX_TENANT_SLUG = 'sandbox-demo';
const SANDBOX_TENANT_NAME = 'SURP Sandbox Demo';
const SANDBOX_USER_USERNAME = 'demo';
const SANDBOX_USER_EMAIL = 'demo@surp.rs';

type ResetCounts = Record<string, number>;

export type InternalSandboxResetResult = {
  tenantSlug: string;
  deleted: ResetCounts;
  seeded: ResetCounts;
  durationMs: number;
};

type DemoStation = {
  id: string;
  name: string;
  address: string;
  category: StationCategory;
};

type DemoLine = {
  id: string;
  name: string;
  route: string[];
};

type DemoRide = {
  id: string;
  lineId: string;
  name: string;
  capacity: number;
  departures: Array<{ dayOfWeek: number; times: string[] }>;
};

@Injectable()
export class InternalSandboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  async reset(): Promise<InternalSandboxResetResult> {
    const startedAt = Date.now();
    const password = this.configService.get<string>('SANDBOX_DEMO_PASSWORD')?.trim();

    if (!password) {
      throw new ServiceUnavailableException('Sandbox demo password is not configured');
    }

    const passwordHash = await hash(password, 10);

    const result = await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(77441122)`;

        const tenant = await tx.tenant.upsert({
          where: { slug: SANDBOX_TENANT_SLUG },
          update: {
            name: SANDBOX_TENANT_NAME,
            timezone: 'Europe/Belgrade',
            isActive: true,
            deactivatedAt: null,
            deactivatedById: null
          },
          create: {
            slug: SANDBOX_TENANT_SLUG,
            name: SANDBOX_TENANT_NAME,
            timezone: 'Europe/Belgrade',
            isActive: true,
            deactivatedAt: null,
            deactivatedById: null
          },
          select: { id: true }
        });

        const deleted = await this.clearTenantData(tx, tenant.id);
        const seeded = await this.seedTenantData(tx, tenant.id, passwordHash);

        return {
          deleted,
          seeded
        };
      },
      { timeout: 20000, maxWait: 10000 }
    );

    return {
      tenantSlug: SANDBOX_TENANT_SLUG,
      deleted: result.deleted,
      seeded: result.seeded,
      durationMs: Date.now() - startedAt
    };
  }

  private async clearTenantData(
    tx: Prisma.TransactionClient,
    tenantId: string
  ): Promise<ResetCounts> {
    const deleted: ResetCounts = {};

    deleted.ticketAttachments = (await tx.ticketAttachment.deleteMany({ where: { tenantId } })).count;
    deleted.ticketComments = (await tx.ticketComment.deleteMany({ where: { tenantId } })).count;
    deleted.tickets = (await tx.ticket.deleteMany({ where: { tenantId } })).count;
    deleted.reservations = (await tx.reservation.deleteMany({ where: { tenantId } })).count;
    deleted.rideExceptions = (await tx.rideException.deleteMany({ where: { tenantId } })).count;
    deleted.rideDayScheduleStationTimes = (
      await tx.rideDayScheduleStationTime.deleteMany({ where: { tenantId } })
    ).count;
    deleted.rideDaySchedules = (await tx.rideDaySchedule.deleteMany({ where: { tenantId } })).count;
    deleted.rides = (await tx.ride.deleteMany({ where: { tenantId } })).count;
    deleted.lineStops = (await tx.lineStop.deleteMany({ where: { tenantId } })).count;
    deleted.lines = (await tx.line.deleteMany({ where: { tenantId } })).count;
    deleted.passengers = (await tx.passenger.deleteMany({ where: { tenantId } })).count;
    deleted.stations = (await tx.station.deleteMany({ where: { tenantId } })).count;
    deleted.storefront = (await tx.agencyStorefront.deleteMany({ where: { tenantId } })).count;
    deleted.refreshSessions = (await tx.refreshSession.deleteMany({ where: { tenantId } })).count;
    deleted.auditEvents = (await tx.auditEvent.deleteMany({ where: { tenantId } })).count;
    deleted.users = (await tx.user.deleteMany({ where: { tenantId } })).count;

    return deleted;
  }

  private async seedTenantData(
    tx: Prisma.TransactionClient,
    tenantId: string,
    passwordHash: string
  ): Promise<ResetCounts> {
    const seeded: ResetCounts = {};
    const user = await tx.user.create({
      data: {
        tenantId,
        username: SANDBOX_USER_USERNAME,
        email: SANDBOX_USER_EMAIL,
        passwordHash,
        role: UserRole.MANAGER,
        isActive: true,
        requirePasswordChange: false
      },
      select: { id: true }
    });

    seeded.users = 1;
    seeded.stations = await this.createStations(tx, tenantId, user.id);
    seeded.lines = await this.createLines(tx, tenantId, user.id);
    seeded.rides = await this.createRides(tx, tenantId, user.id);
    seeded.passengers = await this.createPassengers(tx, tenantId, user.id);
    seeded.reservations = await this.createReservations(tx, tenantId, user.id);

    return seeded;
  }

  private async createStations(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string
  ): Promise<number> {
    const stations = this.demoStations();
    const result = await tx.station.createMany({
      data: stations.map((station) => ({
        ...station,
        tenantId,
        createdById: userId,
        updatedById: userId,
        isActive: true
      }))
    });

    return result.count;
  }

  private async createLines(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string
  ): Promise<number> {
    const lines = this.demoLines();

    for (const line of lines) {
      await tx.line.create({
        data: {
          id: line.id,
          tenantId,
          name: line.name,
          departureStationId: line.route[0],
          arrivalStationId: line.route[line.route.length - 1],
          directionMode: LineDirectionMode.SINGLE,
          direction: LineDirection.OUTBOUND,
          isActive: true,
          createdById: userId,
          updatedById: userId,
          intermediateStops: {
            create: line.route.slice(1, -1).map((stationId, index) => ({
              tenantId,
              stationId,
              orderIndex: index + 1,
              createdById: userId,
              updatedById: userId
            }))
          }
        }
      });
    }

    return lines.length;
  }

  private async createRides(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string
  ): Promise<number> {
    const linesById = new Map(this.demoLines().map((line) => [line.id, line]));
    const rides = this.demoRides();

    for (const ride of rides) {
      const line = linesById.get(ride.lineId);
      if (!line) {
        continue;
      }

      await tx.ride.create({
        data: {
          id: ride.id,
          tenantId,
          lineId: ride.lineId,
          name: ride.name,
          capacity: ride.capacity,
          type: RideType.RECURRING,
          status: RideStatus.ACTIVE,
          recurringStartDate: this.dateFromNow(-14),
          recurringEndDate: this.dateFromNow(180),
          createdById: userId,
          updatedById: userId,
          daySchedules: {
            create: ride.departures.map((departure) => ({
              tenantId,
              dayOfWeek: departure.dayOfWeek,
              createdById: userId,
              updatedById: userId,
              stationTimes: {
                create: line.route.map((stationId, index) => ({
                  tenantId,
                  stationId,
                  orderIndex: index,
                  time: departure.times[index],
                  createdById: userId,
                  updatedById: userId
                }))
              }
            }))
          }
        }
      });
    }

    return rides.length;
  }

  private async createPassengers(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string
  ): Promise<number> {
    const passengers = this.demoPassengers();
    const result = await tx.passenger.createMany({
      data: passengers.map((passenger, index) => ({
        id: `sandbox-passenger-${index + 1}`,
        tenantId,
        firstName: passenger.firstName,
        lastName: passenger.lastName,
        phone: `+38164${String(2100000 + index).padStart(7, '0')}`,
        email: `${passenger.firstName.toLowerCase()}.${passenger.lastName.toLowerCase()}@demo.surp.rs`,
        passengerType: passenger.type,
        notes: passenger.notes,
        isActive: true,
        createdById: userId,
        updatedById: userId
      }))
    });

    return result.count;
  }

  private async createReservations(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string
  ): Promise<number> {
    const rides = this.demoRides();
    const linesById = new Map(this.demoLines().map((line) => [line.id, line]));
    const reservations: Prisma.ReservationCreateManyInput[] = [];

    rides.forEach((ride, rideIndex) => {
      const line = linesById.get(ride.lineId);
      if (!line) {
        return;
      }

      const firstDeparture = ride.departures[0];
      const travelDate = this.dateFromNow(rideIndex + 1);
      const departureStationId = line.route[0];
      const arrivalStationId = line.route[line.route.length - 1];

      for (let seatNumber = 1; seatNumber <= 10; seatNumber += 1) {
        const passengerIndex = ((rideIndex * 10 + seatNumber - 1) % this.demoPassengers().length) + 1;
        const isCancelled = seatNumber % 7 === 0;

        reservations.push({
          id: `sandbox-reservation-${rideIndex + 1}-${seatNumber}`,
          tenantId,
          rideId: ride.id,
          passengerId: `sandbox-passenger-${passengerIndex}`,
          travelDate,
          rideDepartureTime: firstDeparture.times[0],
          rideArrivalTime: firstDeparture.times[firstDeparture.times.length - 1],
          seatNumber,
          status: isCancelled ? ReservationStatus.CANCELLED : ReservationStatus.ACTIVE,
          cancelledAt: isCancelled ? new Date() : null,
          departureStationId,
          arrivalStationId,
          createdById: userId,
          updatedById: userId
        });
      }
    });

    const result = await tx.reservation.createMany({ data: reservations });

    return result.count;
  }

  private demoStations(): DemoStation[] {
    return [
      {
        id: 'sandbox-station-novi-pazar',
        name: 'Novi Pazar',
        address: 'Autobuska stanica Novi Pazar',
        category: StationCategory.BUS_STATION
      },
      {
        id: 'sandbox-station-sjenica',
        name: 'Sjenica',
        address: 'Autobusko stajalište Sjenica',
        category: StationCategory.BUS_STOP
      },
      {
        id: 'sandbox-station-nova-varos',
        name: 'Nova Varoš',
        address: 'Autobuska stanica Nova Varoš',
        category: StationCategory.BUS_STOP
      },
      {
        id: 'sandbox-station-priboj',
        name: 'Priboj',
        address: 'Autobuska stanica Priboj',
        category: StationCategory.BUS_STATION
      },
      {
        id: 'sandbox-station-sarajevo',
        name: 'Sarajevo',
        address: 'Autobuska stanica Sarajevo',
        category: StationCategory.BUS_STATION
      },
      {
        id: 'sandbox-station-beograd',
        name: 'Beograd BAS',
        address: 'Železnička 4, Beograd',
        category: StationCategory.BUS_STATION
      },
      {
        id: 'sandbox-station-novi-sad',
        name: 'Novi Sad',
        address: 'Bulevar Jaše Tomića 6, Novi Sad',
        category: StationCategory.BUS_STATION
      },
      {
        id: 'sandbox-station-subotica',
        name: 'Subotica',
        address: 'Senćanski put 5, Subotica',
        category: StationCategory.BUS_STATION
      },
      {
        id: 'sandbox-station-nis',
        name: 'Niš',
        address: 'Bulevar 12. februar, Niš',
        category: StationCategory.BUS_STATION
      },
      {
        id: 'sandbox-station-kragujevac',
        name: 'Kragujevac',
        address: 'Autobuska stanica Kragujevac',
        category: StationCategory.BUS_STATION
      },
      {
        id: 'sandbox-station-kraljevo',
        name: 'Kraljevo',
        address: 'Autobuska stanica Kraljevo',
        category: StationCategory.BUS_STATION
      },
      {
        id: 'sandbox-station-uzice',
        name: 'Užice',
        address: 'Autobuska stanica Užice',
        category: StationCategory.BUS_STATION
      }
    ];
  }

  private demoLines(): DemoLine[] {
    return [
      {
        id: 'sandbox-line-np-sarajevo',
        name: 'Novi Pazar - Sarajevo',
        route: [
          'sandbox-station-novi-pazar',
          'sandbox-station-sjenica',
          'sandbox-station-nova-varos',
          'sandbox-station-priboj',
          'sandbox-station-sarajevo'
        ]
      },
      {
        id: 'sandbox-line-np-beograd',
        name: 'Novi Pazar - Beograd',
        route: [
          'sandbox-station-novi-pazar',
          'sandbox-station-kraljevo',
          'sandbox-station-kragujevac',
          'sandbox-station-beograd'
        ]
      },
      {
        id: 'sandbox-line-beograd-subotica',
        name: 'Beograd - Novi Sad - Subotica',
        route: ['sandbox-station-beograd', 'sandbox-station-novi-sad', 'sandbox-station-subotica']
      },
      {
        id: 'sandbox-line-nis-beograd',
        name: 'Niš - Beograd',
        route: ['sandbox-station-nis', 'sandbox-station-kragujevac', 'sandbox-station-beograd']
      },
      {
        id: 'sandbox-line-uzice-np',
        name: 'Užice - Novi Pazar',
        route: ['sandbox-station-uzice', 'sandbox-station-nova-varos', 'sandbox-station-sjenica', 'sandbox-station-novi-pazar']
      }
    ];
  }

  private demoRides(): DemoRide[] {
    return [
      {
        id: 'sandbox-ride-np-sarajevo-morning',
        lineId: 'sandbox-line-np-sarajevo',
        name: 'Jutarnji polazak za Sarajevo',
        capacity: 49,
        departures: [
          { dayOfWeek: 1, times: ['07:30', '08:25', '09:05', '09:50', '12:15'] },
          { dayOfWeek: 3, times: ['07:30', '08:25', '09:05', '09:50', '12:15'] },
          { dayOfWeek: 5, times: ['07:30', '08:25', '09:05', '09:50', '12:15'] }
        ]
      },
      {
        id: 'sandbox-ride-np-beograd-express',
        lineId: 'sandbox-line-np-beograd',
        name: 'Novi Pazar - Beograd Express',
        capacity: 55,
        departures: [
          { dayOfWeek: 1, times: ['06:00', '08:20', '09:35', '11:15'] },
          { dayOfWeek: 2, times: ['06:00', '08:20', '09:35', '11:15'] },
          { dayOfWeek: 4, times: ['14:30', '16:50', '18:05', '19:45'] },
          { dayOfWeek: 6, times: ['08:00', '10:20', '11:35', '13:15'] }
        ]
      },
      {
        id: 'sandbox-ride-bg-subotica',
        lineId: 'sandbox-line-beograd-subotica',
        name: 'Severna linija',
        capacity: 45,
        departures: [
          { dayOfWeek: 1, times: ['09:00', '10:25', '12:00'] },
          { dayOfWeek: 3, times: ['16:00', '17:25', '19:00'] },
          { dayOfWeek: 5, times: ['16:00', '17:25', '19:00'] }
        ]
      },
      {
        id: 'sandbox-ride-nis-beograd',
        lineId: 'sandbox-line-nis-beograd',
        name: 'Niš - Beograd poslovni polazak',
        capacity: 51,
        departures: [
          { dayOfWeek: 2, times: ['05:45', '07:30', '09:10'] },
          { dayOfWeek: 4, times: ['05:45', '07:30', '09:10'] },
          { dayOfWeek: 6, times: ['11:30', '13:15', '14:55'] }
        ]
      },
      {
        id: 'sandbox-ride-uzice-np',
        lineId: 'sandbox-line-uzice-np',
        name: 'Zlatiborska veza',
        capacity: 35,
        departures: [
          { dayOfWeek: 0, times: ['10:15', '11:05', '11:55', '13:05'] },
          { dayOfWeek: 5, times: ['18:00', '18:50', '19:40', '20:50'] }
        ]
      }
    ];
  }

  private demoPassengers(): Array<{
    firstName: string;
    lastName: string;
    type: PassengerType;
    notes: string;
  }> {
    const names = [
      ['Ana', 'Petrović', PassengerType.ADULT],
      ['Milan', 'Ristić', PassengerType.ADULT],
      ['Jelena', 'Savić', PassengerType.STUDENT],
      ['Nikola', 'Ilić', PassengerType.ADULT],
      ['Amina', 'Hadžić', PassengerType.STUDENT],
      ['Marko', 'Jovanović', PassengerType.ADULT],
      ['Sara', 'Kovačević', PassengerType.CHILD],
      ['Dragan', 'Đorđević', PassengerType.SENIOR],
      ['Lejla', 'Mehmedović', PassengerType.ADULT],
      ['Stefan', 'Pavlović', PassengerType.STUDENT],
      ['Marija', 'Nikolić', PassengerType.ADULT],
      ['Emir', 'Delić', PassengerType.ADULT],
      ['Ivana', 'Stanković', PassengerType.ADULT],
      ['Petar', 'Lazarević', PassengerType.SENIOR],
      ['Nina', 'Milić', PassengerType.STUDENT],
      ['Vuk', 'Popović', PassengerType.ADULT],
      ['Tamara', 'Vasić', PassengerType.ADULT],
      ['Ognjen', 'Matić', PassengerType.CHILD],
      ['Emina', 'Begić', PassengerType.ADULT],
      ['Luka', 'Todorović', PassengerType.STUDENT],
      ['Milica', 'Obradović', PassengerType.ADULT],
      ['Haris', 'Alić', PassengerType.ADULT],
      ['Katarina', 'Perić', PassengerType.ADULT],
      ['Filip', 'Simić', PassengerType.STUDENT],
      ['Sofija', 'Marković', PassengerType.CHILD],
      ['Vesna', 'Božić', PassengerType.SENIOR],
      ['Adnan', 'Karić', PassengerType.ADULT],
      ['Teodora', 'Živković', PassengerType.ADULT],
      ['Miloš', 'Cvetković', PassengerType.ADULT],
      ['Nađa', 'Imamović', PassengerType.STUDENT],
      ['Uroš', 'Radović', PassengerType.ADULT],
      ['Dunja', 'Tomić', PassengerType.ADULT],
      ['Kenan', 'Softić', PassengerType.ADULT],
      ['Isidora', 'Lukić', PassengerType.STUDENT],
      ['Aleksandar', 'Maksimović', PassengerType.ADULT],
      ['Mira', 'Vuković', PassengerType.SENIOR]
    ] as const;

    return names.map(([firstName, lastName, type], index) => ({
      firstName,
      lastName,
      type,
      notes: index % 6 === 0 ? 'Preferira sedište do prozora.' : 'Demo putnik za sandbox.'
    }));
  }

  private dateFromNow(days: number): Date {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() + days);
    return date;
  }
}
