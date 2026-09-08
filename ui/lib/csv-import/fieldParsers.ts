import { normalizeKey, toTitleCase } from "./normalize"

/**
 * Booking shorthand agencies append to a passenger name. These are not part of
 * the name, so they are lifted into the reservation note instead of dropped.
 */
const NAME_NOISE_TOKENS = new Set([
  "ONL",
  "ONLINE",
  "PLACENO",
  "PLACENA",
  "PLC",
  "REZ",
  "REZERVISANO",
  "OTKAZANO",
  "AGENCIJA",
  "GRATIS",
])

export interface ParsedName {
  firstName: string
  lastName: string
  /** Booking shorthand lifted out of the name, kept for the note field. */
  residue: string
  /** Set when the split had to be guessed, so the row can ask for a review. */
  splitReason?: string
}

/**
 * Stands in for a surname the CSV never carried. Agencies routinely write a
 * single given name ("RANKO"), and blocking the whole line on a surname the
 * file does not have only makes the operator retype the rest of it. The row is
 * filled in and flagged instead, so it imports and stays visibly incomplete.
 */
export const MISSING_LAST_NAME_PLACEHOLDER = "Nepoznato"

/**
 * Fills the placeholder surname when a name arrived without one. A name with
 * no given name at all is left alone: there is nothing there to import, and
 * validation should say so rather than dress it up.
 */
export function withPlaceholderLastName(parsed: ParsedName): ParsedName {
  if (parsed.lastName.trim().length > 0 || parsed.firstName.trim().length === 0) {
    return parsed
  }

  return {
    ...parsed,
    lastName: MISSING_LAST_NAME_PLACEHOLDER,
    splitReason: `Prezime nije bilo u CSV-u, upisano je "${MISSING_LAST_NAME_PLACEHOLDER}", dopunite ga`,
  }
}

/**
 * Splits "IME I PREZIME" into its two parts.
 *
 * The column is written first-name-first, so the *last* token is the surname
 * and everything before it is the given name: "Ana Marija Petrovic" is Ana
 * Marija Petrovic, not Ana Marija. No token is ever dropped into the note —
 * a name silently losing its surname imports a wrong record that validation
 * cannot see — but any split beyond a plain two-token name is a guess, so it
 * is reported for the operator to confirm. A lone given name gets the
 * placeholder surname, also reported.
 */
export function parseFullName(rawName: string): ParsedName {
  const tokens = rawName
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)

  const nameTokens: string[] = []
  const residueTokens: string[] = []

  tokens.forEach((token) => {
    if (NAME_NOISE_TOKENS.has(normalizeKey(token))) {
      residueTokens.push(token)
      return
    }

    nameTokens.push(token)
  })

  const residue = residueTokens.join(" ").trim()

  if (nameTokens.length === 0) {
    return { firstName: "", lastName: "", residue }
  }

  if (nameTokens.length === 1) {
    return withPlaceholderLastName({
      firstName: toTitleCase(nameTokens[0]),
      lastName: "",
      residue,
    })
  }

  const lastName = nameTokens[nameTokens.length - 1]
  const firstName = nameTokens.slice(0, -1).join(" ")

  return {
    firstName: toTitleCase(firstName),
    lastName: toTitleCase(lastName),
    residue,
    splitReason:
      nameTokens.length > 2
        ? `Ime je podeljeno iz ${nameTokens.length} reci, proverite ime i prezime`
        : undefined,
  }
}

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

function isRealDate(year: number, month: number, day: number): boolean {
  const candidate = new Date(Date.UTC(year, month - 1, day))

  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  )
}

/**
 * Accepts DD/MM/YYYY, DD.MM.YYYY, DD-MM-YYYY and ISO YYYY-MM-DD. Day-first is
 * assumed because that is the regional convention in these exports.
 */
export function parseCsvDate(rawDate: string): string | null {
  const value = rawDate.trim()
  if (value.length === 0) {
    return null
  }

  const isoMatch = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (isoMatch) {
    const [, year, month, day] = isoMatch.map(Number)
    return isRealDate(year, month, day) ? `${year}-${pad(month)}-${pad(day)}` : null
  }

  const dayFirstMatch = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/)
  if (!dayFirstMatch) {
    return null
  }

  const day = Number(dayFirstMatch[1])
  const month = Number(dayFirstMatch[2])
  const rawYear = Number(dayFirstMatch[3])
  const year = rawYear < 100 ? 2000 + rawYear : rawYear

  return isRealDate(year, month, day) ? `${year}-${pad(month)}-${pad(day)}` : null
}

export interface ParsedPhone {
  phone: string
  /**
   * Set only when the correction was a guess rather than a reversal of a known
   * export quirk. Restoring a dropped national zero, expanding `00`, and adding
   * `+` to digits that already start with a country code are all mechanical and
   * would warn on nearly every row, which just trains operators to ignore
   * warnings. Inferring an absent country code is a real guess.
   */
  uncertainReason?: string
}

/**
 * Country codes seen in these files, longest first so that 381 is tested
 * before 38 would be. Used only to decide whether a leading run of digits is
 * already a country code.
 */
const KNOWN_COUNTRY_CODES = [
  "381", "382", "383", "385", "386", "387", "389", "352", "353", "356", "358", "359",
  "30", "31", "32", "33", "34", "36", "39", "40", "41", "43", "44", "45", "46", "47",
  "48", "49", "90",
]

/** Serbian mobile prefixes appear as 06x; spreadsheets drop the leading zero. */
const SERBIAN_MOBILE_LEAD = "6"
/** Turkish mobile numbers are 10 digits and always begin with 5. */
const TURKISH_MOBILE_LEAD = "5"

/**
 * Spreadsheet exports mangle phone numbers in two consistent ways: national
 * numbers lose their leading zero (`628246580` was `062 824 6580`) and
 * international ones lose the `+` or the country code entirely
 * (`5322782363` is a Turkish mobile, `+90 532 278 2363`).
 *
 * Only the genuinely uncertain correction — inventing a country code that was
 * never in the file — is reported for review.
 */
export function parseCsvPhone(rawPhone: string): ParsedPhone {
  const trimmed = rawPhone.replace(/[^\d+]/g, "")
  if (trimmed.length === 0) {
    return { phone: "" }
  }

  if (trimmed.startsWith("+")) {
    return { phone: trimmed }
  }

  const digits = trimmed.replace(/\D/g, "")

  // 00 is the international prefix written out.
  if (digits.startsWith("00") && digits.length > 4) {
    return { phone: `+${digits.slice(2)}` }
  }

  // Already a national number.
  if (digits.startsWith("0")) {
    return { phone: digits }
  }

  if (
    digits.length >= 8 &&
    digits.length <= 9 &&
    digits.startsWith(SERBIAN_MOBILE_LEAD)
  ) {
    return { phone: `0${digits}` }
  }

  if (digits.length === 10 && digits.startsWith(TURKISH_MOBILE_LEAD)) {
    return {
      phone: `+90${digits}`,
      uncertainReason: "pretpostavljen turski pozivni broj +90",
    }
  }

  const countryCode = KNOWN_COUNTRY_CODES.find((code) => digits.startsWith(code))
  if (countryCode && digits.length >= 10) {
    return { phone: `+${digits}` }
  }

  return { phone: digits }
}

const TRUTHY_KEYS = new Set(["DA", "YES", "Y", "TRUE", "1", "X", "POVRATNA"])

export function parseBooleanCell(rawValue: string): boolean {
  return TRUTHY_KEYS.has(normalizeKey(rawValue))
}

export function parseSeatNumber(rawValue: string): number | null {
  const digits = rawValue.replace(/[^\d]/g, "")
  if (digits.length === 0) {
    return null
  }

  const seatNumber = Number(digits)
  return Number.isInteger(seatNumber) && seatNumber > 0 ? seatNumber : null
}
