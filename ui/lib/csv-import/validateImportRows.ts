import type { RideInstance } from "@/types"
import type { ImportIssue, ImportRow, ImportRowState } from "./types"

export interface ValidationContext {
  rideInstancesById: Record<string, RideInstance>
  /** Seats already booked in the system, keyed by ride instance id. */
  bookedSeatsByRideInstanceId: Record<string, number[]>
  knownStationIds: Set<string>
}

const MIN_PHONE_DIGITS = 8
const MAX_SEAT_NUMBER = 100

function countDigits(value: string): number {
  return value.replace(/\D/g, "").length
}

function validateSingleRow(row: ImportRow, context: ValidationContext): ImportIssue[] {
  const issues: ImportIssue[] = []

  if (row.firstName.trim().length === 0) {
    issues.push({ field: "firstName", severity: "error", message: "Ime je obavezno" })
  }

  if (row.lastName.trim().length === 0) {
    issues.push({
      field: "lastName",
      severity: "error",
      message:
        row.source.name.trim().length > 0
          ? "Prezime nije prepoznato u CSV-u, unesite ga rucno"
          : "Prezime je obavezno",
    })
  }

  const phoneDigits = countDigits(row.phone)
  if (phoneDigits === 0) {
    issues.push({ field: "phone", severity: "error", message: "Telefon je obavezan" })
  } else if (phoneDigits < MIN_PHONE_DIGITS) {
    issues.push({ field: "phone", severity: "error", message: "Telefon je prekratak" })
  }

  if (row.travelDate.length === 0) {
    issues.push({
      field: "travelDate",
      severity: "error",
      message:
        row.source.travelDate.trim().length === 0
          ? "Datum putovanja nedostaje u CSV-u, unesite ga rucno"
          : `Datum nije prepoznat: "${row.source.travelDate}"`,
    })
  }

  if (!row.departureStationId) {
    issues.push({
      field: "departureStationId",
      severity: "error",
      message: `Polazna stanica nije prepoznata: "${row.source.departure}"`,
    })
  } else if (!context.knownStationIds.has(row.departureStationId)) {
    issues.push({
      field: "departureStationId",
      severity: "error",
      message: "Polazna stanica vise ne postoji",
    })
  }

  if (!row.arrivalStationId) {
    issues.push({
      field: "arrivalStationId",
      severity: "error",
      message: `Dolazna stanica nije prepoznata: "${row.source.arrival}"`,
    })
  } else if (!context.knownStationIds.has(row.arrivalStationId)) {
    issues.push({
      field: "arrivalStationId",
      severity: "error",
      message: "Dolazna stanica vise ne postoji",
    })
  }

  if (
    row.departureStationId &&
    row.arrivalStationId &&
    row.departureStationId === row.arrivalStationId
  ) {
    issues.push({
      field: "arrivalStationId",
      severity: "error",
      message: "Polazna i dolazna stanica ne mogu biti iste",
    })
  }

  const rideInstance = row.rideInstanceId
    ? context.rideInstancesById[row.rideInstanceId]
    : undefined

  if (!row.rideInstanceId) {
    issues.push({
      field: "rideInstanceId",
      severity: "error",
      message:
        row.rideInstanceCandidateIds.length > 1
          ? "Vise voznji odgovara ovoj relaciji, izaberite jednu"
          : "Nema voznje za ovaj datum i relaciju",
    })
  } else if (!rideInstance) {
    issues.push({ field: "rideInstanceId", severity: "error", message: "Voznja vise ne postoji" })
  }

  if (row.seatNumber === null) {
    issues.push({
      field: "seatNumber",
      severity: "error",
      message: rideInstance ? "Nema slobodnih sedista na voznji" : "Sediste nije dodeljeno",
    })
  } else if (row.seatNumber < 1 || row.seatNumber > MAX_SEAT_NUMBER) {
    issues.push({
      field: "seatNumber",
      severity: "error",
      message: `Sediste mora biti izmedju 1 i ${MAX_SEAT_NUMBER}`,
    })
  } else if (rideInstance && row.seatNumber > rideInstance.ride.busCapacity) {
    issues.push({
      field: "seatNumber",
      severity: "error",
      message: `Voznja ima ${rideInstance.ride.busCapacity} sedista`,
    })
  } else if (
    row.rideInstanceId &&
    (context.bookedSeatsByRideInstanceId[row.rideInstanceId] ?? []).includes(row.seatNumber)
  ) {
    issues.push({
      field: "seatNumber",
      severity: "error",
      message: "Sediste je vec zauzeto u sistemu",
    })
  }

  if (row.nameSplitReason) {
    issues.push({ field: "lastName", severity: "warning", message: row.nameSplitReason })
  }

  if (row.phoneUncertainReason) {
    issues.push({
      field: "phone",
      severity: "warning",
      message: `Telefon dopunjen iz "${row.source.phone.trim()}": ${row.phoneUncertainReason}`,
    })
  }

  if (row.departureNote) {
    issues.push({ field: "departureStationId", severity: "warning", message: row.departureNote })
  }

  if (row.arrivalNote) {
    issues.push({ field: "arrivalStationId", severity: "warning", message: row.arrivalNote })
  }

  if (row.departureMatch === "fuzzy" || row.departureMatch === "prefix") {
    issues.push({
      field: "departureStationId",
      severity: "warning",
      message: `Stanica je pogodjena priblizno iz "${row.source.departure}", proverite`,
    })
  }

  if (row.arrivalMatch === "fuzzy" || row.arrivalMatch === "prefix") {
    issues.push({
      field: "arrivalStationId",
      severity: "warning",
      message: `Stanica je pogodjena priblizno iz "${row.source.arrival}", proverite`,
    })
  }

  return issues
}

/** Seat collisions between two rows of the same import, on the same ride. */
function findDuplicateSeatRowIds(rows: ImportRow[]): Set<string> {
  const rowIdsBySeatKey = new Map<string, string[]>()

  rows.forEach((row) => {
    if (row.excluded || !row.rideInstanceId || row.seatNumber === null) {
      return
    }

    const seatKey = `${row.rideInstanceId}#${row.seatNumber}`
    rowIdsBySeatKey.set(seatKey, [...(rowIdsBySeatKey.get(seatKey) ?? []), row.id])
  })

  const duplicates = new Set<string>()
  rowIdsBySeatKey.forEach((rowIds) => {
    if (rowIds.length > 1) {
      rowIds.forEach((rowId) => duplicates.add(rowId))
    }
  })

  return duplicates
}

export function validateImportRows(
  rows: ImportRow[],
  context: ValidationContext
): ImportRowState[] {
  const duplicateSeatRowIds = findDuplicateSeatRowIds(rows)

  return rows.map((row) => {
    if (row.excluded) {
      return { ...row, issues: [], isValid: true }
    }

    const issues = validateSingleRow(row, context)

    if (duplicateSeatRowIds.has(row.id)) {
      issues.push({
        field: "seatNumber",
        severity: "error",
        message: "Isto sediste je dodeljeno drugom redu u ovom uvozu",
      })
    }

    return {
      ...row,
      issues,
      isValid: issues.every((issue) => issue.severity !== "error"),
    }
  })
}

export function summarizeRows(rows: ImportRowState[]) {
  const included = rows.filter((row) => !row.excluded)
  const valid = included.filter((row) => row.isValid)

  return {
    total: rows.length,
    included: included.length,
    excluded: rows.length - included.length,
    valid: valid.length,
    invalid: included.length - valid.length,
    withWarnings: valid.filter((row) => row.issues.length > 0).length,
    canSubmit: included.length > 0 && included.every((row) => row.isValid),
  }
}
