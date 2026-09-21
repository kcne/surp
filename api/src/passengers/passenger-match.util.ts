export function normalizeNameForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizePhoneForMatch(value: string): string {
  return value.replace(/\D+/g, '');
}

/**
 * Last 8 digits, so `+38765261603` and `065261603` compare equal. Both spellings
 * of one number are in the production data.
 */
export function phoneKeyForIdentity(phone: string | null | undefined): string {
  const digits = normalizePhoneForMatch(phone ?? '');

  return digits.length > 8 ? digits.slice(-8) : digits;
}

/**
 * First and last name folded and sorted, so a row entered the other way round
 * still matches. Mirrors `samePassenger` in the CSV import (#13).
 */
export function nameKeyForIdentity(firstName: string, lastName: string): string {
  return [normalizeNameForMatch(firstName), normalizeNameForMatch(lastName)]
    .filter((part) => part.length > 0)
    .sort()
    .join(' ');
}
