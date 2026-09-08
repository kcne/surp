import { normalizeKey, normalizeTokens } from "./normalize"
import {
  lookupStationAlias,
  type StationAliasMap,
  type StationAliasResolution,
  type StationAliasTarget,
  type StationColumn,
} from "./stationAliases"

export interface MatchableStation {
  id: string
  name: string
}

export type StationMatchConfidence = "alias" | "exact" | "prefix" | "fuzzy" | "manual" | "none"

export interface StationMatch {
  stationId: string | null
  confidence: StationMatchConfidence
  /** Ranked alternatives to offer in the cell dropdown, best first. */
  candidateIds: string[]
  note?: string
}

const MAX_CANDIDATES = 5
/** Below this token-overlap score a fuzzy hit is offered but never auto-applied. */
const FUZZY_AUTO_THRESHOLD = 0.75

function scoreTokenOverlap(rawTokens: string[], stationTokens: string[]): number {
  if (rawTokens.length === 0 || stationTokens.length === 0) {
    return 0
  }

  const stationSet = new Set(stationTokens)
  const shared = rawTokens.filter((token) => stationSet.has(token)).length
  if (shared === 0) {
    return 0
  }

  // Symmetric so that "BEOGRAD" against "BEOGRAD STEKO" does not outrank an
  // exact "BEOGRAD" station just by being a subset.
  return (2 * shared) / (rawTokens.length + stationTokens.length)
}

export interface StationMatchOptions {
  /**
   * Which CSV column the spelling came from. Only matters for aliases that
   * resolve differently by column; omit it and the alias's top-level target
   * is used.
   */
  column?: StationColumn
  /**
   * The station the other column of the same row resolved to, when it is
   * already known. Only matters for aliases that resolve differently
   * depending on the other end of the trip.
   */
  counterpartStationId?: string | null
}

export function matchStation(
  rawStation: string,
  stations: MatchableStation[],
  aliases: StationAliasMap,
  { column, counterpartStationId }: StationMatchOptions = {}
): StationMatch {
  const raw = rawStation.trim()
  if (raw.length === 0) {
    return { stationId: null, confidence: "none", candidateIds: [] }
  }

  const stationsByNormalizedName = new Map<string, MatchableStation>()
  stations.forEach((station) => {
    const key = normalizeKey(station.name)
    if (!stationsByNormalizedName.has(key)) {
      stationsByNormalizedName.set(key, station)
    }
  })

  const alias = lookupStationAlias(aliases, raw)

  if (alias?.action === "manual") {
    return { stationId: null, confidence: "manual", candidateIds: [], note: alias.note }
  }

  if (alias) {
    const columnTarget = column ? alias.byColumn?.[column] : undefined
    const columnResolution: StationAliasTarget = columnTarget ?? alias

    const counterpart = counterpartStationId
      ? stations.find((station) => station.id === counterpartStationId)
      : undefined
    const counterpartResolution = counterpart
      ? columnResolution.byCounterpart?.[normalizeKey(counterpart.name)]
      : undefined

    const target: StationAliasResolution = counterpartResolution ?? columnResolution

    const aliasedById = target.stationId
      ? stations.find((station) => station.id === target.stationId)
      : undefined
    const aliasedByName = target.stationName
      ? stationsByNormalizedName.get(normalizeKey(target.stationName))
      : undefined
    const aliased = aliasedById ?? aliasedByName

    if (aliased) {
      return {
        stationId: aliased.id,
        confidence: "alias",
        candidateIds: [aliased.id],
        note: target.note,
      }
    }
  }

  const rawKey = normalizeKey(raw)

  const exact = stationsByNormalizedName.get(rawKey)
  if (exact) {
    return { stationId: exact.id, confidence: "exact", candidateIds: [exact.id] }
  }

  const rawTokens = normalizeTokens(raw)

  const ranked = stations
    .map((station) => {
      const stationKey = normalizeKey(station.name)
      const isPrefix = stationKey.startsWith(`${rawKey} `) || rawKey.startsWith(`${stationKey} `)

      return {
        station,
        isPrefix,
        score: scoreTokenOverlap(rawTokens, normalizeTokens(station.name)),
      }
    })
    .filter((entry) => entry.score > 0 || entry.isPrefix)
    .sort((left, right) => {
      if (left.isPrefix !== right.isPrefix) {
        return left.isPrefix ? -1 : 1
      }

      return right.score - left.score
    })

  const candidateIds = ranked.slice(0, MAX_CANDIDATES).map((entry) => entry.station.id)
  const best = ranked[0]

  if (!best) {
    return { stationId: null, confidence: "none", candidateIds: [] }
  }

  const isUnambiguous = ranked.length === 1 || ranked[1].score < best.score

  if (best.isPrefix && isUnambiguous) {
    return { stationId: best.station.id, confidence: "prefix", candidateIds }
  }

  if (best.score >= FUZZY_AUTO_THRESHOLD && isUnambiguous) {
    return { stationId: best.station.id, confidence: "fuzzy", candidateIds }
  }

  return { stationId: null, confidence: "none", candidateIds }
}
