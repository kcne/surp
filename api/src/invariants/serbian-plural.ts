/**
 * Picks the Serbian form a count takes.
 *
 * Serbian has three: 1, 21, 101 take the singular, 2-4 and 22-24 take the
 * paucal, everything else the genitive plural — and the teens are the
 * exception that makes 11 behave like 15 rather than like 1. Counts reach
 * agency staff at the moment a write is refused, so "2 rezervacija" reads as
 * broken software in exactly the wrong place.
 */
export function serbianPlural(count: number, one: string, few: string, many: string): string {
  const lastDigit = Math.abs(count) % 10;
  const lastTwoDigits = Math.abs(count) % 100;

  if (lastDigit === 1 && lastTwoDigits !== 11) {
    return `${count} ${one}`;
  }

  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
    return `${count} ${few}`;
  }

  return `${count} ${many}`;
}
