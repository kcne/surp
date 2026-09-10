import { Injectable } from '@nestjs/common';
import {
  LineDirection,
  LineDirectionMode,
  Prisma,
  ReservationStatus,
  RideStatus
} from '@prisma/client';
import { AccessTokenPayload } from '../auth/auth.types';
import { withUpdateAudit } from '../prisma/audit-write.helper';
import {
  mergePairedRoutes,
  orderedStopIds,
  stopsForDirection,
  unreachableTermini,
  writeLineStopsTx,
  type PairedRouteLine
} from '../lines/line-pair-alignment';
import {
  dayOfWeekOf,
  formatDateOnly,
  materializeInstanceTimesForDate,
  utcDateOf
} from '../rides/ride-instance-materialization';
import { PrismaService } from '../prisma/prisma.service';
import {
  classifyReservation,
  findOffRouteStationIds,
  resolveSeatNumber,
  type OrphanReason
} from './orphaned-reservations';
import {
  OrphanedReservationItemDto,
  OrphanedReservationReportDto,
  OrphanedReservationRepairResultDto
} from './dto/orphaned-reservation.response.dto';
import {
  describeScheduleDrift,
  isScheduleAlignedToRoute,
  realignDayScheduleTx,
  routeStationIdsOf
} from '../rides/ride-schedule-alignment';
import {
  PairDriftItemDto,
  PairDriftReportDto,
  PairSyncResultDto
} from './dto/pair-drift.response.dto';
import {
  ReturnRouteGapItemDto,
  ReturnRouteGapReportDto
} from './dto/return-route-gap.response.dto';
import {
  ScheduleDriftItemDto,
  ScheduleDriftReportDto,
  ScheduleRealignResultDto
} from './dto/schedule-drift.response.dto';

interface DriftedSchedule {
  item: ScheduleDriftItemDto;
  tenantId: string;
  rideDayScheduleId: string;
  stationTimes: Array<{ stationId: string; orderIndex: number; time: string | null }>;
  routeStationIds: string[];
}

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getScheduleDriftReport(auth: AccessTokenPayload): Promise<ScheduleDriftReportDto> {
    const { drifted, scannedScheduleCount } = await this.findDriftedSchedules(auth.tenantId);

    return {
      scannedScheduleCount,
      driftedScheduleCount: drifted.length,
      affectedRideCount: new Set(drifted.map((entry) => entry.item.rideId)).size,
      items: drifted.map((entry) => entry.item)
    };
  }

  async realignSchedules(auth: AccessTokenPayload): Promise<ScheduleRealignResultDto> {
    const { drifted } = await this.findDriftedSchedules(auth.tenantId);

    // Each schedule is repaired in its own transaction so one failure cannot
    // roll back repairs that already succeeded.
    let estimatedTimeCount = 0;

    let reorderedScheduleCount = 0;

    for (const entry of drifted) {
      const result = await this.prisma.$transaction((tx) =>
        realignDayScheduleTx(tx, {
          tenantId: entry.tenantId,
          rideDayScheduleId: entry.rideDayScheduleId,
          stationTimes: entry.stationTimes,
          routeStationIds: entry.routeStationIds,
          actorId: auth.sub
        })
      );

      estimatedTimeCount += result.estimatedTimeCount;
      reorderedScheduleCount += result.reorderedScheduleIds.length;
    }

    return {
      realignedScheduleCount: drifted.length,
      affectedRideCount: new Set(drifted.map((entry) => entry.item.rideId)).size,
      estimatedTimeCount,
      reorderedScheduleCount,
      items: drifted.map((entry) => entry.item)
    };
  }

  private async findDriftedSchedules(
    tenantId: string
  ): Promise<{ drifted: DriftedSchedule[]; scannedScheduleCount: number }> {
    const lines = await this.prisma.line.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        departureStationId: true,
        arrivalStationId: true,
        intermediateStops: {
          select: { stationId: true, orderIndex: true },
          orderBy: { orderIndex: 'asc' }
        },
        rides: {
          select: {
            id: true,
            name: true,
            daySchedules: {
              select: {
                id: true,
                dayOfWeek: true,
                stationTimes: {
                  select: { stationId: true, orderIndex: true, time: true },
                  orderBy: { orderIndex: 'asc' }
                }
              }
            }
          }
        }
      }
    });

    const stationNameById = await this.getStationNameLookup(tenantId);
    const drifted: DriftedSchedule[] = [];
    let scannedScheduleCount = 0;

    for (const line of lines) {
      const routeStationIds = routeStationIdsOf(line);

      for (const ride of line.rides) {
        for (const daySchedule of ride.daySchedules) {
          scannedScheduleCount += 1;

          if (isScheduleAlignedToRoute(daySchedule.stationTimes, routeStationIds)) {
            continue;
          }

          const drift = describeScheduleDrift(daySchedule.stationTimes, routeStationIds);
          const toNames = (stationIds: string[]) =>
            stationIds.map((stationId) => stationNameById.get(stationId) ?? stationId);

          drifted.push({
            tenantId,
            rideDayScheduleId: daySchedule.id,
            stationTimes: daySchedule.stationTimes,
            routeStationIds,
            item: {
              rideId: ride.id,
              rideName: ride.name,
              lineId: line.id,
              lineName: line.name,
              dayOfWeek: daySchedule.dayOfWeek,
              scheduleStationCount: daySchedule.stationTimes.length,
              routeStationCount: routeStationIds.length,
              addedStationNames: toNames(drift.addedStationIds),
              removedStationNames: toNames(drift.removedStationIds),
              reorderedStationNames: toNames(drift.reorderedStationIds)
            }
          });
        }
      }
    }

    return { drifted, scannedScheduleCount };
  }

  async getPairDriftReport(auth: AccessTokenPayload): Promise<PairDriftReportDto> {
    const { drifted, scannedPairCount } = await this.findDriftedPairs(auth.tenantId);

    return {
      scannedPairCount,
      driftedPairCount: drifted.length,
      items: drifted.map((entry) => entry.item)
    };
  }

  async syncPairs(auth: AccessTokenPayload): Promise<PairSyncResultDto> {
    const { drifted } = await this.findDriftedPairs(auth.tenantId);

    let syncedPairCount = 0;
    let addedStopCount = 0;
    let realignedScheduleCount = 0;
    let skippedPairCount = 0;

    for (const entry of drifted) {
      // A genuine disagreement between directions is never resolved by guessing.
      if (!entry.mergedStopIds) {
        skippedPairCount += 1;
        continue;
      }

      const mergedStopIds = entry.mergedStopIds;

      const written = await this.prisma.$transaction(async (tx) => {
        let scheduleCount = 0;
        let stopCount = 0;

        for (const { line, reverse } of [
          { line: entry.outbound, reverse: false },
          { line: entry.inbound, reverse: true }
        ]) {
          const nextStops = stopsForDirection(line, mergedStopIds, reverse);
          stopCount += Math.max(nextStops.length - line.intermediateStops.length, 0);

          await writeLineStopsTx(tx, auth.tenantId, line.id, auth.sub, nextStops);

          scheduleCount += await this.reconcileSchedulesForLineTx(tx, auth.tenantId, auth.sub, line.id, [
            line.departureStationId,
            ...nextStops.map((stop) => stop.stationId),
            line.arrivalStationId
          ]);
        }

        return { scheduleCount, stopCount };
      });

      syncedPairCount += 1;
      addedStopCount += written.stopCount;
      realignedScheduleCount += written.scheduleCount;
    }

    return {
      syncedPairCount,
      addedStopCount,
      realignedScheduleCount,
      skippedPairCount,
      items: drifted.map((entry) => entry.item)
    };
  }

  private async reconcileSchedulesForLineTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    actorId: string,
    lineId: string,
    routeStationIds: string[]
  ): Promise<number> {
    const rides = await tx.ride.findMany({
      where: { lineId, tenantId },
      select: {
        daySchedules: {
          select: {
            id: true,
            stationTimes: {
              select: { stationId: true, orderIndex: true, time: true },
              orderBy: { orderIndex: 'asc' }
            }
          }
        }
      }
    });

    let realigned = 0;

    for (const ride of rides) {
      for (const daySchedule of ride.daySchedules) {
        if (isScheduleAlignedToRoute(daySchedule.stationTimes, routeStationIds)) {
          continue;
        }

        await realignDayScheduleTx(tx, {
          tenantId,
          rideDayScheduleId: daySchedule.id,
          stationTimes: daySchedule.stationTimes,
          routeStationIds,
          actorId
        });

        realigned += 1;
      }
    }

    return realigned;
  }

  /**
   * Loads every complete two-sided BOTH pair in the tenant, with the two
   * directions identified. A group that is not exactly two lines cannot be
   * reasoned about as a pair and is skipped.
   */
  private async loadPairs(tenantId: string): Promise<{
    pairs: Array<{
      pairKey: string;
      outbound: PairedRouteLine;
      inbound: PairedRouteLine;
      outboundName: string;
      inboundName: string;
    }>;
    scannedPairCount: number;
  }> {
    const lines = await this.prisma.line.findMany({
      where: {
        tenantId,
        directionMode: LineDirectionMode.BOTH,
        pairKey: { not: null }
      },
      select: {
        id: true,
        name: true,
        pairKey: true,
        direction: true,
        departureStationId: true,
        arrivalStationId: true,
        intermediateStops: {
          select: { stationId: true, orderIndex: true },
          orderBy: { orderIndex: 'asc' }
        }
      }
    });

    const byPairKey = new Map<string, typeof lines>();
    lines.forEach((line) => {
      const key = line.pairKey!;
      byPairKey.set(key, [...(byPairKey.get(key) ?? []), line]);
    });

    const pairs: Array<{
      pairKey: string;
      outbound: PairedRouteLine;
      inbound: PairedRouteLine;
      outboundName: string;
      inboundName: string;
    }> = [];

    for (const [pairKey, group] of Array.from(byPairKey.entries())) {
      if (group.length !== 2) {
        continue;
      }

      const outbound = group.find((line) => line.direction === LineDirection.OUTBOUND) ?? group[0];
      const inbound = group.find((line) => line.id !== outbound.id)!;

      pairs.push({
        pairKey,
        outbound,
        inbound,
        outboundName: outbound.name,
        inboundName: inbound.name
      });
    }

    return { pairs, scannedPairCount: pairs.length };
  }

  private async findDriftedPairs(tenantId: string): Promise<{
    drifted: Array<{
      item: PairDriftItemDto;
      outbound: PairedRouteLine;
      inbound: PairedRouteLine;
      mergedStopIds: string[] | null;
    }>;
    scannedPairCount: number;
  }> {
    const { pairs, scannedPairCount } = await this.loadPairs(tenantId);

    const stationNameById = await this.getStationNameLookup(tenantId);
    const drifted: Array<{
      item: PairDriftItemDto;
      outbound: PairedRouteLine;
      inbound: PairedRouteLine;
      mergedStopIds: string[] | null;
    }> = [];

    for (const { pairKey, outbound, inbound, outboundName, inboundName } of pairs) {
      const outboundStopIds = orderedStopIds(outbound);
      const inboundReversed = [...orderedStopIds(inbound)].reverse();

      if (
        outboundStopIds.length === inboundReversed.length &&
        outboundStopIds.every((stationId, index) => stationId === inboundReversed[index])
      ) {
        continue;
      }

      const merge = mergePairedRoutes(outboundStopIds, inboundReversed);
      const toNames = (ids: string[]) => ids.map((id) => stationNameById.get(id) ?? id);

      drifted.push({
        outbound,
        inbound,
        mergedStopIds: merge.merged ?? null,
        item: {
          pairKey,
          outbound: {
            id: outbound.id,
            name: outboundName,
            stopCount: outboundStopIds.length,
            missingStationNames: toNames(
              inboundReversed.filter((id) => !outboundStopIds.includes(id))
            )
          },
          inbound: {
            id: inbound.id,
            name: inboundName,
            stopCount: inboundReversed.length,
            missingStationNames: toNames(
              outboundStopIds.filter((id) => !inboundReversed.includes(id))
            )
          },
          canAutoSync: Boolean(merge.merged),
          conflictReason: merge.conflict ?? null
        }
      });
    }

    return { drifted, scannedPairCount };
  }

  /**
   * Finds pairs where one direction ends at a station the other never calls at.
   *
   * This is reported rather than repaired. Return tickets swap the outbound
   * leg's stations onto the opposite direction, so the gap blocks every return
   * booking through that terminus — but deciding where the opposite route
   * should call at it is a routing question the data cannot answer, and the two
   * stations are often the same physical place recorded twice.
   */
  async getReturnRouteGapReport(auth: AccessTokenPayload): Promise<ReturnRouteGapReportDto> {
    const { pairs, scannedPairCount } = await this.loadPairs(auth.tenantId);
    const stationNameById = await this.getStationNameLookup(auth.tenantId);

    const items: ReturnRouteGapItemDto[] = [];

    for (const { outbound, inbound, outboundName, inboundName, pairKey } of pairs) {
      for (const [line, other, name, otherName] of [
        [outbound, inbound, outboundName, inboundName],
        [inbound, outbound, inboundName, outboundName]
      ] as Array<[PairedRouteLine, PairedRouteLine, string, string]>) {
        const unreachable = unreachableTermini(line, other);

        if (unreachable.length === 0) {
          continue;
        }

        items.push({
          pairKey,
          lineName: name,
          oppositeLineName: otherName,
          unreachableStationNames: unreachable.map(
            (stationId) => stationNameById.get(stationId) ?? stationId
          )
        });
      }
    }

    return { scannedPairCount, gapCount: items.length, items };
  }

  /**
   * Number of days ahead the orphan scan covers. Reservations further out exist
   * but are far more likely to still be edited before travel, and a report the
   * agency cannot act on today is noise.
   */
  private static readonly ORPHAN_WINDOW_DAYS = 30;

  async getOrphanedReservationReport(
    auth: AccessTokenPayload
  ): Promise<OrphanedReservationReportDto> {
    const scan = await this.scanForOrphans(auth.tenantId);

    return {
      windowStartDate: scan.windowStartDate,
      windowEndDate: scan.windowEndDate,
      scannedReservationCount: scan.scannedReservationCount,
      orphanedCount: scan.items.length,
      repairableCount: scan.items.filter((item) => item.canRepair).length,
      seatChangeCount: scan.items.filter(
        (item) => item.canRepair && item.targetSeatNumber !== item.seatNumber
      ).length,
      items: scan.items
    };
  }

  /**
   * Moves every orphan a single instance can claim onto that instance.
   *
   * The scan is re-run here rather than trusting a report the caller may have
   * loaded minutes ago, so seat assignments are decided against the current
   * state of the bus.
   */
  async repairOrphanedReservations(
    auth: AccessTokenPayload
  ): Promise<OrphanedReservationRepairResultDto> {
    const scan = await this.scanForOrphans(auth.tenantId);

    let repairedCount = 0;
    let seatChangedCount = 0;
    let skippedCount = 0;

    for (const item of scan.items) {
      if (!item.canRepair || !item.targetDepartureTime || item.targetSeatNumber === null) {
        skippedCount += 1;
        continue;
      }

      // One reservation per transaction: a single failure must not roll back
      // passengers already made visible again.
      await this.prisma.reservation.update({
        where: { id: item.reservationId },
        data: withUpdateAudit(
          {
            rideDepartureTime: item.targetDepartureTime,
            rideArrivalTime: item.targetArrivalTime ?? undefined,
            seatNumber: item.targetSeatNumber
          },
          auth.sub
        )
      });

      repairedCount += 1;

      if (item.targetSeatNumber !== item.seatNumber) {
        seatChangedCount += 1;
      }
    }

    return {
      repairedCount,
      seatChangedCount,
      skippedCount,
      items: scan.items
    };
  }

  /**
   * Walks every active reservation travelling inside the window and asks which
   * ride instance, if any, can still reach it.
   */
  private async scanForOrphans(tenantId: string): Promise<{
    windowStartDate: string;
    windowEndDate: string;
    scannedReservationCount: number;
    items: OrphanedReservationItemDto[];
  }> {
    const today = formatDateOnly(new Date())!;
    const windowStart = utcDateOf(today);
    const windowEnd = new Date(windowStart);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + MaintenanceService.ORPHAN_WINDOW_DAYS);
    const windowEndDate = formatDateOnly(windowEnd)!;

    const reservations = await this.prisma.reservation.findMany({
      where: {
        tenantId,
        status: ReservationStatus.ACTIVE,
        travelDate: { gte: windowStart, lte: windowEnd }
      },
      select: {
        id: true,
        rideId: true,
        travelDate: true,
        rideDepartureTime: true,
        rideArrivalTime: true,
        seatNumber: true,
        departureStationId: true,
        arrivalStationId: true,
        passenger: { select: { firstName: true, lastName: true, phone: true } }
      },
      // A stable order makes the report and the repair assign the same seats.
      orderBy: [{ travelDate: 'asc' }, { seatNumber: 'asc' }, { id: 'asc' }]
    });

    if (reservations.length === 0) {
      return {
        windowStartDate: today,
        windowEndDate,
        scannedReservationCount: 0,
        items: []
      };
    }

    const rideIds = [...new Set(reservations.map((reservation) => reservation.rideId))];
    const rides = await this.prisma.ride.findMany({
      where: { id: { in: rideIds }, tenantId },
      select: {
        id: true,
        name: true,
        capacity: true,
        status: true,
        type: true,
        recurringStartDate: true,
        recurringEndDate: true,
        oneTimeDate: true,
        oneTimeDepartureTime: true,
        oneTimeArrivalTime: true,
        line: {
          select: {
            name: true,
            departureStationId: true,
            arrivalStationId: true,
            intermediateStops: { select: { stationId: true } }
          }
        },
        daySchedules: {
          select: {
            dayOfWeek: true,
            stationTimes: { select: { orderIndex: true, time: true } }
          }
        },
        exceptions: {
          where: { exceptionDate: { gte: windowStart, lte: windowEnd } },
          select: { exceptionDate: true, type: true, departureTime: true, arrivalTime: true },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    const rideById = new Map(rides.map((ride) => [ride.id, ride]));
    const stationNameById = await this.getStationNameLookup(tenantId);

    // Instances are derived per ride and date, so cache them: a busy ride can
    // carry dozens of reservations on the same day.
    const instanceCache = new Map<string, ReturnType<typeof materializeInstanceTimesForDate>>();

    const instancesFor = (ride: (typeof rides)[number], travelDate: string) => {
      const key = `${ride.id}:${travelDate}`;
      const cached = instanceCache.get(key);

      if (cached) {
        return cached;
      }

      const exceptionsForDate = ride.exceptions.filter(
        (exception) => formatDateOnly(exception.exceptionDate) === travelDate
      );
      const materialized = materializeInstanceTimesForDate(
        ride,
        exceptionsForDate,
        travelDate,
        dayOfWeekOf(travelDate)
      );

      instanceCache.set(key, materialized);

      return materialized;
    };

    // Seats already spoken for on each instance, so a repair never lands a
    // passenger on top of one who is currently visible.
    const occupiedSeats = new Map<string, Set<number>>();

    const claimSeat = (rideId: string, travelDate: string, departureTime: string, seat: number) => {
      const key = `${rideId}:${travelDate}:${departureTime}`;
      const seats = occupiedSeats.get(key) ?? new Set<number>();
      seats.add(seat);
      occupiedSeats.set(key, seats);
      return seats;
    };

    const orphanCandidates: Array<{
      reservation: (typeof reservations)[number];
      travelDate: string;
      ride: (typeof rides)[number];
      reason: OrphanReason;
      targetDepartureTime: string | null;
      targetArrivalTime: string | null;
    }> = [];

    for (const reservation of reservations) {
      const travelDate = formatDateOnly(reservation.travelDate)!;
      const ride = rideById.get(reservation.rideId);

      if (!ride) {
        continue;
      }

      const classification = classifyReservation(
        { ...reservation, travelDate },
        {
          rideIsActive: ride.status === RideStatus.ACTIVE,
          instances: instancesFor(ride, travelDate)
        }
      );

      if (!classification) {
        // Reachable today, so its seat is genuinely taken.
        claimSeat(reservation.rideId, travelDate, reservation.rideDepartureTime, reservation.seatNumber);
        continue;
      }

      orphanCandidates.push({
        reservation,
        travelDate,
        ride,
        reason: classification.reason,
        targetDepartureTime: classification.targetDepartureTime,
        targetArrivalTime: classification.targetArrivalTime
      });
    }

    // Seats are resolved only after every visible reservation has claimed its
    // own, so an orphan never wins a seat that a visible passenger holds.
    //
    // Orphans are then resolved in two passes rather than one. A single pass
    // lets an orphan whose seat was taken grab the lowest free seat, which is
    // often a seat another orphan could still have kept — moving one passenger
    // then cascades into moving several. Letting everyone who can keep their
    // seat claim it first cut the moves on the tenant this was built for from
    // 66 to 39, and every avoided move is a passenger nobody has to call.
    const seatByReservationId = new Map<string, number | null>();
    const needsAnotherSeat: typeof orphanCandidates = [];

    for (const candidate of orphanCandidates) {
      const { reservation, ride, travelDate, targetDepartureTime } = candidate;

      if (!targetDepartureTime) {
        seatByReservationId.set(reservation.id, null);
        continue;
      }

      const key = `${reservation.rideId}:${travelDate}:${targetDepartureTime}`;
      const taken = occupiedSeats.get(key) ?? new Set<number>();

      if (reservation.seatNumber <= ride.capacity && !taken.has(reservation.seatNumber)) {
        seatByReservationId.set(reservation.id, reservation.seatNumber);
        claimSeat(reservation.rideId, travelDate, targetDepartureTime, reservation.seatNumber);
        continue;
      }

      needsAnotherSeat.push(candidate);
    }

    for (const candidate of needsAnotherSeat) {
      const { reservation, ride, travelDate, targetDepartureTime } = candidate;
      const key = `${reservation.rideId}:${travelDate}:${targetDepartureTime!}`;
      const seat = resolveSeatNumber(
        reservation.seatNumber,
        occupiedSeats.get(key) ?? new Set<number>(),
        ride.capacity
      );

      seatByReservationId.set(reservation.id, seat);

      if (seat !== null) {
        claimSeat(reservation.rideId, travelDate, targetDepartureTime!, seat);
      }
    }

    const items: OrphanedReservationItemDto[] = orphanCandidates.map((candidate) => {
      const { reservation, ride, travelDate, targetDepartureTime } = candidate;
      const routeStationIds = new Set<string>([
        ride.line.departureStationId,
        ride.line.arrivalStationId,
        ...ride.line.intermediateStops.map((stop) => stop.stationId)
      ]);

      const targetSeatNumber = seatByReservationId.get(reservation.id) ?? null;
      const stationName = (stationId: string) => stationNameById.get(stationId) ?? stationId;

      return {
        reservationId: reservation.id,
        passengerName: `${reservation.passenger.firstName} ${reservation.passenger.lastName}`,
        passengerPhone: reservation.passenger.phone,
        travelDate,
        rideName: ride.name,
        lineName: ride.line.name,
        departureStationName: stationName(reservation.departureStationId),
        arrivalStationName: stationName(reservation.arrivalStationId),
        currentDepartureTime: reservation.rideDepartureTime,
        targetDepartureTime,
        targetArrivalTime: candidate.targetArrivalTime,
        seatNumber: reservation.seatNumber,
        targetSeatNumber,
        reason: candidate.reason,
        canRepair: targetDepartureTime !== null && targetSeatNumber !== null,
        offRouteStationNames: findOffRouteStationIds(
          { ...reservation, travelDate },
          routeStationIds
        ).map(stationName)
      };
    });

    return {
      windowStartDate: today,
      windowEndDate,
      scannedReservationCount: reservations.length,
      items
    };
  }

  private async getStationNameLookup(tenantId: string): Promise<Map<string, string>> {
    const stations = await this.prisma.station.findMany({
      where: { tenantId },
      select: { id: true, name: true }
    });

    return new Map(stations.map((station) => [station.id, station.name]));
  }
}
