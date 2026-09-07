const BOM = "﻿"

function stripBom(input: string): string {
  return input.startsWith(BOM) ? input.slice(BOM.length) : input
}

/**
 * Counts a candidate delimiter in the header row, ignoring anything inside
 * quotes. Counting the raw text instead would let a comma in a quoted header
 * ("Ime, Prezime";Datum) outvote the real semicolon delimiter and collapse the
 * whole file into a single column.
 */
function countInHeaderRow(input: string, delimiter: string): number {
  let count = 0
  let inQuotes = false

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]

    if (inQuotes) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          index += 1
          continue
        }

        inQuotes = false
      }

      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }

    if (char === "\n") {
      break
    }

    if (char === delimiter) {
      count += 1
    }
  }

  return count
}

function detectDelimiter(input: string): string {
  const candidates = [",", ";", "\t"]

  let best = ","
  let bestCount = -1

  candidates.forEach((candidate) => {
    const count = countInHeaderRow(input, candidate)
    if (count > bestCount) {
      best = candidate
      bestCount = count
    }
  })

  return best
}

/**
 * Minimal RFC 4180 parser: handles quoted fields, escaped quotes, embedded
 * newlines and CRLF. Kept in-repo so CSV import needs no extra dependency.
 */
export function parseCsv(input: string): string[][] {
  const text = stripBom(input)
  const delimiter = detectDelimiter(text)

  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  let index = 0

  const pushField = () => {
    row.push(field)
    field = ""
  }

  const pushRow = () => {
    pushField()
    rows.push(row)
    row = []
  }

  while (index < text.length) {
    const char = text[index]

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 2
          continue
        }

        inQuotes = false
        index += 1
        continue
      }

      field += char
      index += 1
      continue
    }

    if (char === '"' && field.trim().length === 0) {
      field = ""
      inQuotes = true
      index += 1
      continue
    }

    if (char === delimiter) {
      pushField()
      index += 1
      continue
    }

    if (char === "\r") {
      index += 1
      continue
    }

    if (char === "\n") {
      pushRow()
      index += 1
      continue
    }

    field += char
    index += 1
  }

  if (field.length > 0 || row.length > 0) {
    pushRow()
  }

  return rows.filter((current) => current.some((value) => value.trim().length > 0))
}
