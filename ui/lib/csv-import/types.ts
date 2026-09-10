import type { ImportDuplicateInfo } from "./duplicateDetection"
import type { StationMatchConfidence } from "./stationMatching"

export type ImportRowField =
  | "firstName"
  | "lastName"
  | "phone"
  | "travelDate"
  | "departureStationId"
  | "arrivalStationId"
  | "rideInstanceId"
  | "seatNumber"
  | "notes"

export type ImportIssueSeverity = "error" | "warning"

export interface ImportIssue {
  field: ImportRowField | "row"
  severity: ImportIssueSeverity
  message: string
}

export type ImportLeg = "outbound" | "return"

/** Verbatim CSV values, kept so the operator can always see the source text. */
export interface ImportRowSource {
  lineNumber: number
  externalId: string
  name: string
  departure: string
  arrival: string
  travelDate: string
  phone: string
}

export interface ImportRow {
  id: string
  /** Shared by the outbound and return legs produced from one CSV line. */
  groupKey: string
  leg: ImportLeg
  source: ImportRowSource

  firstName: string
  lastName: string
  /** Set when the name split was guessed rather than a plain "Ime Prezime". */
  nameSplitReason?: string
  phone: string
  /** Set when the phone country code was guessed rather than read. */
  phoneUncertainReason?: string
  /** Existing passenger to reuse; null means "create on import". */
  passengerId: string | null

  travelDate: string
  departureStationId: string | null
  arrivalStationId: string | null
  departureMatch: StationMatchConfidence
  arrivalMatch: StationMatchConfidence
  /** Alias guidance worth showing the operator, if the mapping carried any. */
  departureNote?: string
  arrivalNote?: string

  rideInstanceId: string | null
  /** Ride instances whose route covers departure -> arrival on `travelDate`. */
  rideInstanceCandidateIds: string[]

  seatNumber: number | null
  /** True while the seat is system-suggested rather than operator-chosen. */
  seatIsAutoAssigned: boolean

  notes: string
  excluded: boolean
  /**
   * Who decided this row's inclusion: `auto-excluded` marks an exclusion made
   * by duplicate detection and taken back once the row stops being one,
   * `manual` an operator choice detection must never overrule.
   */
  duplicateResolution: "auto-excluded" | "manual" | null
}

export interface ImportRowState extends ImportRow {
  issues: ImportIssue[]
  isValid: boolean
  /** The trip this row repeats, if any. */
  duplicate: ImportDuplicateInfo | null
}

export interface ParseCsvFileResult {
  rows: ImportRow[]
  unmappedHeaders: string[]
  missingColumns: string[]
  skippedLineNumbers: number[]
}
