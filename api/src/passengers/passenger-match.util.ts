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
