import { unreachableTermini, type PairedRouteLine } from '../../lines/line-pair-alignment';
import { CheckResult, Invariant, InvariantContext } from '../invariant.types';
import { loadPairs, loadStationNames, stationNamer } from './tenant-lookups';

/**
 * A return ticket takes the outbound leg's two stations, swaps them, and looks
 * for both on the opposite direction's route. When one direction ends at a
 * station the other never calls at, every return booking through that terminus
 * fails with a message about the chosen stations that says nothing about the
 * route setup that caused it.
 *
 * Reported, never repaired. Placing a terminus onto the opposite route means
 * deciding where along that route the bus calls at it, which the data cannot
 * answer — and the two stations are often one physical place recorded twice, so
 * inserting one beside the other would make a route call at the same place
 * twice.
 */

export interface ReturnRouteGapItem {
  pairKey: string;
  lineName: string;
  oppositeLineName: string;
  unreachableStationNames: string[];
}

export async function findReturnRouteGaps(
  ctx: InvariantContext
): Promise<{ gaps: ReturnRouteGapItem[]; scannedPairCount: number }> {
  const { pairs, scannedPairCount } = await loadPairs(ctx);
  const toName = stationNamer(await loadStationNames(ctx));

  const gaps: ReturnRouteGapItem[] = [];

  for (const { outbound, inbound, outboundName, inboundName, pairKey } of pairs) {
    for (const [line, other, name, otherName] of [
      [outbound, inbound, outboundName, inboundName],
      [inbound, outbound, inboundName, outboundName]
    ] as Array<[PairedRouteLine, PairedRouteLine, string, string]>) {
      const unreachable = unreachableTermini(line, other);

      if (unreachable.length === 0) {
        continue;
      }

      gaps.push({
        pairKey,
        lineName: name,
        oppositeLineName: otherName,
        unreachableStationNames: unreachable.map(toName)
      });
    }
  }

  return { gaps, scannedPairCount };
}

export const terminiReachable: Invariant = {
  key: 'pair.terminiReachable',
  title: 'Krajnja stanica je dostupna sa suprotnog smera',
  description:
    'Povratna karta trazi obe stanice na suprotnom smeru. Ako jedan smer zavrsava na stanici koju drugi uopste ne dodiruje, povratna karta preko te stanice nije moguca.',
  severity: 'warning',

  async check(ctx: InvariantContext): Promise<CheckResult> {
    const { gaps, scannedPairCount } = await findReturnRouteGaps(ctx);

    return {
      scannedCount: scannedPairCount,
      violations: gaps.map((gap) => ({
        subjectType: 'line-pair' as const,
        subjectId: gap.pairKey,
        summary: `Linija "${gap.lineName}" zavrsava na stanici koju "${gap.oppositeLineName}" ne dodiruje: ${gap.unreachableStationNames.join(', ')}.`,
        detail: { ...gap },
        canRepair: false
      }))
    };
  }

  // No repair: where the opposite route should call at the terminus is a
  // routing decision, and the two stations are often the same place twice.
};
