const DIACRITIC_REPLACEMENTS: Array<[RegExp, string]> = [
  [/[ĆćĈĉ]/g, "C"],
  [/[Čč]/g, "C"],
  [/[Šš]/g, "S"],
  [/[Žž]/g, "Z"],
  [/[Đđ]/g, "DJ"],
  [/[ÜüŰű]/g, "U"],
  [/[ÖöŐő]/g, "O"],
  [/[Ğğ]/g, "G"],
  [/[İı]/g, "I"],
  [/[Şş]/g, "S"],
  [/[ÇçĊċ]/g, "C"],
]

/** Latin-extended and Serbian/Turkish letters folded to plain ASCII. */
export function stripDiacritics(value: string): string {
  const decomposed = value.normalize("NFD").replace(/[̀-ͯ]/g, "")

  return DIACRITIC_REPLACEMENTS.reduce(
    (accumulator, [pattern, replacement]) => accumulator.replace(pattern, replacement),
    decomposed
  )
}

/** Canonical comparison key: ASCII, uppercase, punctuation-free, single-spaced. */
export function normalizeKey(value: string): string {
  return stripDiacritics(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

export function normalizeTokens(value: string): string[] {
  const key = normalizeKey(value)
  return key.length > 0 ? key.split(" ") : []
}

export function toTitleCase(value: string): string {
  return value
    .toLocaleLowerCase("sr-RS")
    .replace(/(^|[\s\-'])(\p{L})/gu, (_match, prefix: string, letter: string) =>
      `${prefix}${letter.toLocaleUpperCase("sr-RS")}`
    )
}
