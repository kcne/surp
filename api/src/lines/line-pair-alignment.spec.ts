import {
  isSubsequence,
  mergePairedRoutes,
  stopsForDirection,
  unreachableTermini
} from './line-pair-alignment';

describe('line pair alignment', () => {
  describe('mergePairedRoutes', () => {
    it('takes the richer side when the other is missing stops', () => {
      // The real case: Edirne and KUMBURGAZ were added outbound only.
      const result = mergePairedRoutes(
        ['nis', 'edirne', 'kumburgaz', 'montenegro'],
        ['nis', 'montenegro']
      );

      expect(result.merged).toEqual(['nis', 'edirne', 'kumburgaz', 'montenegro']);
    });

    it('takes the opposite side when it is the richer one', () => {
      const result = mergePairedRoutes(['a', 'c'], ['a', 'b', 'c']);

      expect(result.merged).toEqual(['a', 'b', 'c']);
    });

    it('merges nothing when the two directions are already equal', () => {
      const result = mergePairedRoutes(['a', 'b'], ['a', 'b']);

      expect(result.merged).toEqual(['a', 'b']);
    });

    it('refuses to guess when each direction has stops the other lacks', () => {
      const result = mergePairedRoutes(['a', 'b'], ['a', 'c']);

      expect(result.merged).toBeUndefined();
      expect(result.conflict).toBeTruthy();
    });

    it('refuses to guess when the relative order disagrees', () => {
      const result = mergePairedRoutes(['a', 'b', 'c'], ['a', 'c', 'b']);

      expect(result.conflict).toBeTruthy();
    });
  });

  describe('isSubsequence', () => {
    it('accepts gaps but not reordering', () => {
      expect(isSubsequence(['a', 'c'], ['a', 'b', 'c'])).toBe(true);
      expect(isSubsequence(['c', 'a'], ['a', 'b', 'c'])).toBe(false);
    });
  });

  describe('stopsForDirection', () => {
    const line = {
      id: 'line-return',
      departureStationId: 'agencija',
      arrivalStationId: 'novi-sad',
      intermediateStops: []
    };

    it('reverses the merged order and renumbers from one', () => {
      const stops = stopsForDirection(line, ['a', 'b', 'c'], true);

      expect(stops).toEqual([
        { stationId: 'c', orderIndex: 1 },
        { stationId: 'b', orderIndex: 2 },
        { stationId: 'a', orderIndex: 3 }
      ]);
    });

    it('drops stops that are this direction own endpoints', () => {
      // "agencija" is this line's terminus, so it must not also be a stop.
      const stops = stopsForDirection(line, ['agencija', 'b', 'novi-sad'], false);

      expect(stops).toEqual([{ stationId: 'b', orderIndex: 1 }]);
    });
  });
  describe('unreachableTermini', () => {
    // The real case: outbound ends at Istanbul Balbus, the return departs from
    // Agencija and never calls at Istanbul Balbus.
    const outbound = {
      id: 'out',
      departureStationId: 'novi-sad',
      arrivalStationId: 'istanbul-balbus',
      intermediateStops: [{ stationId: 'montenegro', orderIndex: 1 }]
    };
    const inbound = {
      id: 'in',
      departureStationId: 'agencija',
      arrivalStationId: 'novi-sad',
      intermediateStops: [{ stationId: 'montenegro', orderIndex: 1 }]
    };

    it('flags a terminus the opposite direction never calls at', () => {
      expect(unreachableTermini(outbound, inbound)).toEqual(['istanbul-balbus']);
      expect(unreachableTermini(inbound, outbound)).toEqual(['agencija']);
    });

    it('flags nothing when both termini appear on the opposite route', () => {
      const mirrored = {
        ...inbound,
        departureStationId: 'istanbul-balbus',
        arrivalStationId: 'novi-sad'
      };

      expect(unreachableTermini(outbound, mirrored)).toEqual([]);
      expect(unreachableTermini(mirrored, outbound)).toEqual([]);
    });

    it('counts a terminus that appears as an intermediate stop as reachable', () => {
      const withStop = {
        ...inbound,
        intermediateStops: [
          { stationId: 'istanbul-balbus', orderIndex: 1 },
          { stationId: 'montenegro', orderIndex: 2 }
        ]
      };

      expect(unreachableTermini(outbound, withStop)).toEqual([]);
    });
  });
});
