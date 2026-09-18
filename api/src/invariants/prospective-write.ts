import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Invariant, InvariantContext, Violation } from './invariant.types';
import { findInvariant } from './registry';

const DEFAULT_WINDOW_DAYS = 30;

export const PROSPECTIVE_INVARIANT_KEYS = {
  lineUpdate: ['reservation.reachable', 'reservation.stationsOnRoute', 'reservation.segmentValid'],
  rideUpdate: [
    'reservation.reachable',
    'reservation.seatWithinCapacity',
    'instance.notOverbooked',
    'reservation.stationsOnRoute'
  ],
  rideException: ['reservation.reachable'],
  stationDeactivation: ['route.stationsActive'],
  passengerDeactivation: ['reservation.passengerActive']
} as const;

type ProspectiveInvariantKey =
  (typeof PROSPECTIVE_INVARIANT_KEYS)[keyof typeof PROSPECTIVE_INVARIANT_KEYS][number];

export interface ProspectiveWriteScope {
  tenantId: string;
  actorId: string;
}

/**
 * Applies a write tentatively, asks the existing invariants what changed, and
 * commits only when the proposed state adds no violations (or was confirmed).
 * Comparing against the baseline matters: old drift must stay visible in the
 * integrity report, but it must not make an unrelated edit impossible.
 */
export async function guardProspectiveWrite<TResult>(
  prisma: PrismaService,
  scope: ProspectiveWriteScope,
  keys: readonly ProspectiveInvariantKey[],
  confirmed: boolean,
  write: (tx: Prisma.TransactionClient) => Promise<TResult>
): Promise<TResult> {
  return prisma.$transaction(
    async (tx) => {
      if (confirmed) {
        return write(tx);
      }

      const invariants = keys.map(requireInvariant);
      const before = await checkInvariants(tx, scope, invariants);
      const result = await write(tx);
      const after = await checkInvariants(tx, scope, invariants);

      for (const invariant of invariants) {
        const previousSubjects = new Set(before.get(invariant.key)!.map(violationIdentity));
        const added = after
          .get(invariant.key)!
          .filter((violation) => !previousSubjects.has(violationIdentity(violation)));

        if (added.length > 0) {
          throw new ConflictException({
            code: 'WOULD_BREAK_RESERVATIONS',
            invariant: invariant.key,
            affectedCount: added.length,
            message: conflictMessage(invariant.key, added.length)
          });
        }
      }

      return result;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      maxWait: 5_000,
      timeout: 30_000
    }
  );
}

async function checkInvariants(
  prisma: Prisma.TransactionClient,
  scope: ProspectiveWriteScope,
  invariants: Invariant[]
): Promise<Map<string, Violation[]>> {
  const ctx: InvariantContext = {
    tenantId: scope.tenantId,
    actorId: scope.actorId,
    prisma,
    windowDays: DEFAULT_WINDOW_DAYS
  };
  const result = new Map<string, Violation[]>();

  for (const invariant of invariants) {
    result.set(invariant.key, (await invariant.check(ctx)).violations);
  }

  return result;
}

function requireInvariant(key: ProspectiveInvariantKey): Invariant {
  const invariant = findInvariant(key);

  if (!invariant) {
    throw new Error(`Prospective invariant is not registered: ${key}`);
  }

  return invariant;
}

function violationIdentity(violation: Violation): string {
  return `${violation.subjectType}:${violation.subjectId}`;
}

function conflictMessage(key: string, count: number): string {
  switch (key) {
    case 'reservation.reachable':
      return `Ova izmena cini ${count} rezervacija nevidljivim.`;
    case 'reservation.seatWithinCapacity':
      return `Ova izmena ostavlja ${count} rezervacija sa sedistem koje ne postoji.`;
    case 'instance.notOverbooked':
      return `Ova izmena preopterecuje ${count} polazaka.`;
    case 'reservation.stationsOnRoute':
      return `Ova izmena ostavlja ${count} rezervacija sa stanicom van rute.`;
    case 'reservation.segmentValid':
      return `Ova izmena kvari deonicu za ${count} rezervacija.`;
    case 'route.stationsActive':
      return `Ova izmena ostavlja ${count} linija sa neaktivnom stanicom.`;
    case 'reservation.passengerActive':
      return `Ova izmena ostavlja ${count} aktivnih rezervacija na neaktivnom putniku.`;
    default:
      return `Ova izmena stvara ${count} novih problema sa podacima.`;
  }
}
