import {
  parseBooleanCell,
  parseCsvDate,
  parseCsvPhone,
  parseFullName,
  parseSeatNumber,
  withPlaceholderLastName,
} from "./fieldParsers"
import {
  findMissingRequiredColumns,
  mapHeaderRow,
  readCell,
  type HeaderMap,
} from "./headerMapping"
import { parseCsv } from "./parseCsv"
import { matchStation, type MatchableStation } from "./stationMatching"
import type { StationAliasMap } from "./stationAliases"
import type { ParsedName } from "./fieldParsers"
import type { ImportRow, ImportRowSource, ParseCsvFileResult } from "./types"

interface BuildOptions {
  stations: MatchableStation[]
  aliases: StationAliasMap
}

function readName(row: string[], headerMap: HeaderMap): { raw: string; parsed: ParsedName } {
  const explicitFirst = readCell(row, headerMap, "firstName")
  const explicitLast = readCell(row, headerMap, "lastName")

  if (explicitFirst || explicitLast) {
    return {
      raw: [explicitFirst, explicitLast].filter(Boolean).join(" "),
      parsed: withPlaceholderLastName({
        firstName: explicitFirst,
        lastName: explicitLast,
        residue: "",
      }),
    }
  }

  const raw = readCell(row, headerMap, "name")
  return { raw, parsed: parseFullName(raw) }
}

function buildNotes(residue: string, csvNotes: string): string {
  return [csvNotes, residue].filter((part) => part.trim().length > 0).join(" · ")
}

export function buildImportRows(
  fileContent: string,
  { stations, aliases }: BuildOptions
): ParseCsvFileResult {
  const table = parseCsv(fileContent)

  if (table.length === 0) {
    return { rows: [], unmappedHeaders: [], missingColumns: ["name"], skippedLineNumbers: [] }
  }

  const [headerRow, ...dataRows] = table
  const { headerMap, unmappedHeaders } = mapHeaderRow(headerRow)
  const missingColumns = findMissingRequiredColumns(headerMap)

  if (missingColumns.length > 0) {
    return { rows: [], unmappedHeaders, missingColumns, skippedLineNumbers: [] }
  }

  const rows: ImportRow[] = []
  const skippedLineNumbers: number[] = []

  dataRows.forEach((row, dataIndex) => {
    // +2: one for the header row, one to make it a 1-based spreadsheet line.
    const lineNumber = dataIndex + 2

    const { raw: rawName, parsed: parsedName } = readName(row, headerMap)
    const rawDeparture = readCell(row, headerMap, "departure")
    const rawArrival = readCell(row, headerMap, "arrival")
    const rawTravelDate = readCell(row, headerMap, "travelDate")
    const rawPhone = readCell(row, headerMap, "phone")
    const rawReturnDate = readCell(row, headerMap, "returnDate")
    const rawReturnTicket = readCell(row, headerMap, "returnTicket")
    const csvNotes = readCell(row, headerMap, "notes")

    const hasAnyContent = [rawName, rawDeparture, rawArrival, rawTravelDate, rawPhone].some(
      (value) => value.length > 0
    )

    if (!hasAnyContent) {
      skippedLineNumbers.push(lineNumber)
      return
    }

    const source: ImportRowSource = {
      lineNumber,
      externalId: readCell(row, headerMap, "externalId"),
      name: rawName,
      departure: rawDeparture,
      arrival: rawArrival,
      travelDate: rawTravelDate,
      phone: rawPhone,
    }

    const { phone, uncertainReason } = parseCsvPhone(rawPhone)
    const seatNumber = parseSeatNumber(readCell(row, headerMap, "seatNumber"))
    const notes = buildNotes(parsedName.residue, csvNotes)

    // The column decides the target for spellings that mean different stations
    // depending on where they appear, so it is passed through even though the
    // return leg later reuses these matches with the roles swapped.
    // Two passes: some spellings resolve differently depending on the other
    // end of the trip, and that other end is itself matched here. The first
    // pass reads each column on its own, the second re-reads it knowing where
    // the counterpart landed. Only the first pass ever feeds the second, so
    // the pair cannot chase each other.
    const departureAlone = matchStation(rawDeparture, stations, aliases, {
      column: "departure",
    })
    const arrivalAlone = matchStation(rawArrival, stations, aliases, { column: "arrival" })

    const departureMatch = matchStation(rawDeparture, stations, aliases, {
      column: "departure",
      counterpartStationId: arrivalAlone.stationId,
    })
    const arrivalMatch = matchStation(rawArrival, stations, aliases, {
      column: "arrival",
      counterpartStationId: departureAlone.stationId,
    })

    const groupKey = `line-${lineNumber}`

    rows.push({
      id: `${groupKey}-outbound`,
      groupKey,
      leg: "outbound",
      source,
      firstName: parsedName.firstName,
      lastName: parsedName.lastName,
      nameSplitReason: parsedName.splitReason,
      phone,
      phoneUncertainReason: uncertainReason,
      passengerId: null,
      travelDate: parseCsvDate(rawTravelDate) ?? "",
      departureStationId: departureMatch.stationId,
      arrivalStationId: arrivalMatch.stationId,
      departureMatch: departureMatch.confidence,
      arrivalMatch: arrivalMatch.confidence,
      departureNote: departureMatch.note,
      arrivalNote: arrivalMatch.note,
      rideInstanceId: null,
      rideInstanceCandidateIds: [],
      seatNumber,
      seatIsAutoAssigned: seatNumber === null,
      notes,
      excluded: false,
      duplicateResolution: null,
    })

    // A return leg is asked for by a return date, or by a "povratna karta"
    // flag on its own. The flag alone leaves the date blank on purpose: the
    // row then fails validation and the operator supplies the date, which
    // beats dropping a return the sheet plainly asked for.
    const wantsReturnLeg =
      rawReturnDate.trim().length > 0 || parseBooleanCell(rawReturnTicket)

    if (!wantsReturnLeg) {
      return
    }

    const returnTravelDate = parseCsvDate(rawReturnDate)

    // The return leg is the same passenger travelling the reversed route, so
    // the station matches carry over swapped.
    rows.push({
      id: `${groupKey}-return`,
      groupKey,
      leg: "return",
      source: {
        ...source,
        departure: rawArrival,
        arrival: rawDeparture,
        travelDate: rawReturnDate,
      },
      firstName: parsedName.firstName,
      lastName: parsedName.lastName,
      nameSplitReason: parsedName.splitReason,
      phone,
      phoneUncertainReason: uncertainReason,
      passengerId: null,
      travelDate: returnTravelDate ?? "",
      departureStationId: arrivalMatch.stationId,
      arrivalStationId: departureMatch.stationId,
      departureMatch: arrivalMatch.confidence,
      arrivalMatch: departureMatch.confidence,
      departureNote: arrivalMatch.note,
      arrivalNote: departureMatch.note,
      rideInstanceId: null,
      rideInstanceCandidateIds: [],
      seatNumber: null,
      seatIsAutoAssigned: true,
      notes,
      excluded: false,
      duplicateResolution: null,
    })
  })

  return { rows, unmappedHeaders, missingColumns: [], skippedLineNumbers }
}
