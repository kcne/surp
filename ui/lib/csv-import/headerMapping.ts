import { normalizeKey } from "./normalize"

export type CsvColumnKey =
  | "externalId"
  | "name"
  | "firstName"
  | "lastName"
  | "departure"
  | "arrival"
  | "travelDate"
  | "phone"
  | "seatNumber"
  | "returnTicket"
  | "returnDate"
  | "notes"

/**
 * Header synonyms seen in agency spreadsheets. Keys are already normalized
 * (ASCII, uppercase, punctuation collapsed) so `NORMALIZE` handles the padded
 * and diacritic variants found in exported files.
 */
const HEADER_SYNONYMS: Record<CsvColumnKey, string[]> = {
  externalId: ["ID", "RB", "R BR", "BROJ", "NO"],
  name: ["IME I PREZIME", "PUTNIK", "IME PREZIME", "IME I PREZIME PUTNIKA", "NAZIV"],
  firstName: ["IME"],
  lastName: ["PREZIME"],
  departure: ["POLAZI IZ", "POLAZAK", "POLAZNA STANICA", "OD", "MESTO POLASKA", "RELACIJA OD"],
  arrival: ["DOLAZI U", "DOLAZAK", "DOLAZNA STANICA", "DO", "MESTO DOLASKA", "RELACIJA DO"],
  travelDate: ["DATUM ODLASKA", "DATUM POLASKA", "DATUM", "DATUM PUTOVANJA"],
  phone: ["TELEFON", "BROJ TELEFONA", "KONTAKT", "TEL"],
  seatNumber: ["BR SEDISTA", "BROJ SEDISTA", "SEDISTE", "SEDISTA"],
  returnTicket: ["POVRATNA KARTA", "POVRATNA"],
  returnDate: ["DATUM POVRATKA", "POVRATAK", "DATUM POVRATNE"],
  notes: ["NAPOMENA", "NAPOMENE", "KOMENTAR"],
}

export type HeaderMap = Partial<Record<CsvColumnKey, number>>

export interface HeaderMappingResult {
  headerMap: HeaderMap
  unmappedHeaders: string[]
}

export function mapHeaderRow(headerRow: string[]): HeaderMappingResult {
  const headerMap: HeaderMap = {}
  const unmappedHeaders: string[] = []

  headerRow.forEach((rawHeader, columnIndex) => {
    const key = normalizeKey(rawHeader)
    if (key.length === 0) {
      return
    }

    const matchedColumn = (Object.keys(HEADER_SYNONYMS) as CsvColumnKey[]).find((column) =>
      HEADER_SYNONYMS[column].includes(key)
    )

    if (!matchedColumn || headerMap[matchedColumn] !== undefined) {
      unmappedHeaders.push(rawHeader.trim())
      return
    }

    headerMap[matchedColumn] = columnIndex
  })

  return { headerMap, unmappedHeaders }
}

export function readCell(row: string[], headerMap: HeaderMap, column: CsvColumnKey): string {
  const columnIndex = headerMap[column]
  if (columnIndex === undefined) {
    return ""
  }

  return (row[columnIndex] ?? "").trim()
}

/** Columns without which the file cannot describe a reservation at all. */
export const REQUIRED_COLUMNS: CsvColumnKey[] = ["departure", "arrival", "travelDate"]

export function findMissingRequiredColumns(headerMap: HeaderMap): CsvColumnKey[] {
  const missing = REQUIRED_COLUMNS.filter((column) => headerMap[column] === undefined)
  const hasAnyName =
    headerMap.name !== undefined ||
    headerMap.firstName !== undefined ||
    headerMap.lastName !== undefined

  return hasAnyName ? missing : [...missing, "name"]
}
