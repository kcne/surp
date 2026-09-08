import type { Passenger } from "@/types"
import { MISSING_LAST_NAME_PLACEHOLDER } from "./fieldParsers"
import { normalizeKey } from "./normalize"

/** Last 8 digits, so `+381628246580` and `0628246580` compare equal. */
function phoneKey(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  return digits.length > 8 ? digits.slice(-8) : digits
}

function nameKey(firstName: string, lastName: string): string {
  return [normalizeKey(firstName), normalizeKey(lastName)].sort().join(" ")
}

export interface PassengerIndex {
  byPhoneAndName: Map<string, Passenger>
  byName: Map<string, Passenger[]>
}

export function buildPassengerIndex(passengers: Passenger[]): PassengerIndex {
  const byPhoneAndName = new Map<string, Passenger>()
  const byName = new Map<string, Passenger[]>()

  passengers.forEach((passenger) => {
    const name = nameKey(passenger.firstName, passenger.lastName)
    const phone = phoneKey(passenger.phone)

    if (phone.length > 0) {
      const key = `${phone}#${name}`
      if (!byPhoneAndName.has(key)) {
        byPhoneAndName.set(key, passenger)
      }
    }

    byName.set(name, [...(byName.get(name) ?? []), passenger])
  })

  return { byPhoneAndName, byName }
}

/**
 * Links a row to an existing passenger only on an unambiguous match: same
 * phone and same name, or a single system passenger with that exact name.
 * Anything less certain returns null, which means "create a new passenger".
 */
export function findExistingPassenger(
  index: PassengerIndex,
  firstName: string,
  lastName: string,
  phone: string
): Passenger | null {
  if (firstName.trim().length === 0 || lastName.trim().length === 0) {
    return null
  }

  const name = nameKey(firstName, lastName)
  const normalizedPhone = phoneKey(phone)

  if (normalizedPhone.length > 0) {
    const exact = index.byPhoneAndName.get(`${normalizedPhone}#${name}`)
    if (exact) {
      return exact
    }
  }

  // A placeholder surname is not evidence of identity: two unrelated one-name
  // passengers both read as "Ranko Nepoznato", and merging them onto one
  // record would put someone else's trips on their profile. Such a row links
  // only on the phone match above.
  if (normalizeKey(lastName) === normalizeKey(MISSING_LAST_NAME_PLACEHOLDER)) {
    return null
  }

  const sameName = index.byName.get(name) ?? []
  return sameName.length === 1 ? sameName[0] : null
}
