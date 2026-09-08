import { normalizeKey } from "./normalize"

/** Which CSV column a spelling was read from. */
export type StationColumn = "departure" | "arrival"

/** A resolved target: id wins when present, name survives a database reseed. */
export interface StationAliasResolution {
  stationId?: string
  stationName?: string
  /** Shown on the row as a warning, for mappings worth a second look. */
  note?: string
}

/**
 * A target, plus the exceptions the other end of the trip forces. Shorthand
 * that means "our office" is read against the destination: a trip whose
 * arrival is the office's own town cannot also start there, so `byCounterpart`
 * names the station the *other* column resolved to (a `normalizeKey`-ed
 * station name) and overrides the target for that pairing. Exceptions are read
 * one level deep only — they resolve, they do not chain.
 */
export interface StationAliasTarget extends StationAliasResolution {
  byCounterpart?: Record<string, StationAliasResolution>
}

/**
 * One CSV station spelling mapped onto a system station.
 *
 * `action: "manual"` marks a value that is genuinely not a station, so those
 * rows always require an operator to choose.
 *
 * `byColumn` covers spellings that mean different stations depending on where
 * they appear. Agencies write shorthand from their own point of view — "the
 * agency" means the local office when a passenger boards there and the
 * destination office when they arrive — so one word maps to two stations. When
 * `byColumn` has no entry for the column, the top-level target applies.
 */
export interface StationAlias extends StationAliasTarget {
  action?: "manual"
  byColumn?: Partial<Record<StationColumn, StationAliasTarget>>
}

export type StationAliasMap = Record<string, StationAlias>

/**
 * Tenant-scoped alias tables, keyed by tenant slug.
 *
 * These are generated, not hand-written: run the prompt in
 * `docs/import/station-alias-prompt.md` against the tenant's live station list
 * and paste the resulting object here. Keys must be `normalizeKey` output.
 */
const ALIASES_BY_TENANT: Record<string, StationAliasMap> = {
  // Generated for tenant `balbus-rs` against its live station list.
  // Only spellings the matcher cannot resolve on its own belong here: every
  // other CSV spelling already matches a station exactly or by prefix.
  "balbus-rs": {
    // Three Belgrade stops share this prefix. The sheet names the other two
    // explicitly ("BEOGRAD STEKO", "BEOGRAD ZMAJ PUMPA"), so a bare "BEOGRAD"
    // is the main station.
    BEOGRAD: { stationName: "Beograd BAS" },

    // Overrides an exact-name match. The tenant has both "Montenegro" and
    // "Montenegro Istanbul" on the same Istanbul street; "Montenegro Istanbul"
    // is the live stop, so the bare name must not win here.
    // The tenant also has a station plainly named "Montenegro" on the same
    // Istanbul street, which is the retired duplicate. Aliasing here stops the
    // bare name winning by exact match. Settled, so it raises no row warning.
    MONTENEGRO: { stationName: "Montenegro Istanbul" },

    // Ambiguous against "Montenegro Istanbul"; the bare city name is the
    // Istanbul Balbus terminus.
    ISTANBUL: { stationName: "Istanbul Balbus" },

    // Resolves to the same stop as "NIS NAIS", which already matches
    // "Nis - Nais" exactly. The alias is still needed because a bare "NIS"
    // ties between "Nis - Nais" and "Nis - eco" and so never auto-resolves.
    NIS: { stationName: "Nis - Nais" },

    // The sheet writes "the agency" from the writer's point of view: boarding
    // at the agency means the Novi Pazar office, arriving at the agency means
    // the Istanbul one. Same word, two stations, decided by the column.
    AGENCIJA: {
      byColumn: {
        departure: {
          stationName: "Novi Pazar",
          // Every row in this file with AGENCIJA as the departure carries a
          // Turkish phone number and a Serbian destination, which reads as a
          // departure from Istanbul instead. Flagged rather than overridden,
          // because the rule is the agency's to set, not ours to infer.
          note: "Polazak iz AGENCIJA je mapiran na Novi Pazar — proverite, moguce je Istanbul",
          byCounterpart: {
            // Arriving in Novi Pazar settles it: the trip cannot also start
            // there, so this AGENCIJA is the Istanbul office. Confident, so
            // it drops the "proverite" note the default carries.
            "NOVI PAZAR": { stationName: "Istanbul Balbus" },
          },
        },
        arrival: { stationName: "Istanbul Balbus" },
      },
    },
  },
}

export function getStationAliases(tenantSlug: string | null | undefined): StationAliasMap {
  if (!tenantSlug) {
    return {}
  }

  return ALIASES_BY_TENANT[tenantSlug.toLowerCase()] ?? {}
}

export function lookupStationAlias(
  aliases: StationAliasMap,
  rawStation: string
): StationAlias | undefined {
  return aliases[normalizeKey(rawStation)]
}
