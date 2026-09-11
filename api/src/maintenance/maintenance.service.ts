import { Injectable } from '@nestjs/common';
import { AccessTokenPayload } from '../auth/auth.types';
import {
  findDriftedPairs,
  syncDriftedPairs
} from '../invariants/checks/paired-directions-agree';
import {
  buildOrphanReport,
  repairOrphanedReservations
} from '../invariants/checks/reservation-reachable';
import {
  findDriftedSchedules,
  realignDriftedSchedules
} from '../invariants/checks/schedule-matches-route';
import { findReturnRouteGaps } from '../invariants/checks/termini-reachable';
import { InvariantContext } from '../invariants/invariant.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  OrphanedReservationReportDto,
  OrphanedReservationRepairResultDto
} from './dto/orphaned-reservation.response.dto';
import { PairDriftReportDto, PairSyncResultDto } from './dto/pair-drift.response.dto';
import { ReturnRouteGapReportDto } from './dto/return-route-gap.response.dto';
import {
  ScheduleDriftReportDto,
  ScheduleRealignResultDto
} from './dto/schedule-drift.response.dto';

/**
 * Shapes the four checks that already had endpoints and a settings card into
 * the response bodies the UI still calls.
 *
 * The logic itself lives in `invariants/checks`, where it is reachable by the
 * cron run and by CI as well. This class is the compatibility layer until #24
 * moves the UI onto the generic invariant endpoints.
 */
@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Checks take a context rather than an auth payload: the same check has to run
   * from a cron job and from CI, where no user is signed in.
   */
  private contextFor(auth: AccessTokenPayload): InvariantContext {
    return {
      tenantId: auth.tenantId,
      actorId: auth.sub,
      prisma: this.prisma,
      windowDays: MaintenanceService.ORPHAN_WINDOW_DAYS
    };
  }

  async getScheduleDriftReport(auth: AccessTokenPayload): Promise<ScheduleDriftReportDto> {
    const { drifted, scannedScheduleCount } = await findDriftedSchedules(this.contextFor(auth));

    return {
      scannedScheduleCount,
      driftedScheduleCount: drifted.length,
      affectedRideCount: new Set(drifted.map((entry) => entry.item.rideId)).size,
      items: drifted.map((entry) => entry.item)
    };
  }

  async realignSchedules(auth: AccessTokenPayload): Promise<ScheduleRealignResultDto> {
    const { drifted, estimatedTimeCount, reorderedScheduleCount } = await realignDriftedSchedules(
      this.contextFor(auth)
    );

    return {
      realignedScheduleCount: drifted.length,
      affectedRideCount: new Set(drifted.map((entry) => entry.item.rideId)).size,
      estimatedTimeCount,
      reorderedScheduleCount,
      items: drifted.map((entry) => entry.item)
    };
  }

  async getPairDriftReport(auth: AccessTokenPayload): Promise<PairDriftReportDto> {
    const { drifted, scannedPairCount } = await findDriftedPairs(this.contextFor(auth));

    return {
      scannedPairCount,
      driftedPairCount: drifted.length,
      items: drifted.map((entry) => entry.item)
    };
  }

  async syncPairs(auth: AccessTokenPayload): Promise<PairSyncResultDto> {
    const { drifted, syncedPairCount, addedStopCount, realignedScheduleCount, skippedPairCount } =
      await syncDriftedPairs(this.contextFor(auth));

    return {
      syncedPairCount,
      addedStopCount,
      realignedScheduleCount,
      skippedPairCount,
      items: drifted.map((entry) => entry.item)
    };
  }

  async getReturnRouteGapReport(auth: AccessTokenPayload): Promise<ReturnRouteGapReportDto> {
    const { gaps, scannedPairCount } = await findReturnRouteGaps(this.contextFor(auth));

    return { scannedPairCount, gapCount: gaps.length, items: gaps };
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
    return buildOrphanReport(this.contextFor(auth));
  }

  async repairOrphanedReservations(
    auth: AccessTokenPayload
  ): Promise<OrphanedReservationRepairResultDto> {
    return repairOrphanedReservations(this.contextFor(auth));
  }
}
