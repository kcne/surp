import { TYPE, parse, type MessageFormatElement } from "@formatjs/icu-messageformat-parser"
import { describe, expect, it } from "vitest"

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, getFormattingLocale, type SupportedLocale } from "@/i18n/locales"
import { getCatalog } from "@/i18n/messages"
import { MESSAGE_NAMESPACES, type MessageNamespace } from "@/i18n/namespaces"

/**
 * Rejects incomplete or divergent message catalogs.
 *
 * A missing translation degrades silently at runtime — the Serbian fallback
 * kicks in and nobody notices an English page is half Serbian — so the gate
 * has to be here, before the code ships.
 *
 * Each check is a pure function over catalog objects, so the same code runs
 * against the real catalogs and against the deliberately broken ones below.
 */

type Catalog = Record<string, unknown>
type Leaf = string | string[]

/** Flatten to `a.b.c` leaves; arrays of strings stay whole so length can be compared. */
function flatten(node: Catalog, prefix = "", out = new Map<string, Leaf>()): Map<string, Leaf> {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (Array.isArray(value) || value === null || typeof value !== "object") {
      out.set(path, value as Leaf)
    } else {
      flatten(value as Catalog, path, out)
    }
  }
  return out
}

/** Keys one catalog has and the other does not, in both directions. */
function keyProblems(catalog: Catalog, reference: Catalog): string[] {
  const leaves = flatten(catalog)
  const referenceLeaves = flatten(reference)
  return [
    ...[...referenceLeaves.keys()].filter((path) => !leaves.has(path)).map((path) => `${path}: missing`),
    ...[...leaves.keys()]
      .filter((path) => !referenceLeaves.has(path))
      .map((path) => `${path}: not in "${DEFAULT_LOCALE}"`),
  ]
}

/** Values that would render as nothing, and arrays that changed length in translation. */
function valueProblems(catalog: Catalog, reference: Catalog): string[] {
  const referenceLeaves = flatten(reference)
  return [...flatten(catalog)].flatMap(([path, value]) => {
    const expected = referenceLeaves.get(path)
    if (Array.isArray(expected)) {
      if (!Array.isArray(value)) return [`${path}: expected an array`]
      if (value.length !== expected.length) {
        return [`${path}: has ${value.length} entries, "${DEFAULT_LOCALE}" has ${expected.length}`]
      }
      return value.some((entry) => typeof entry !== "string" || entry.trim() === "")
        ? [`${path}: contains an empty entry`]
        : []
    }
    if (typeof value !== "string") return [`${path}: expected a string, found ${typeof value}`]
    return value.trim() === "" ? [`${path}: is empty`] : []
  })
}

function messages(catalog: Catalog): [string, string][] {
  return [...flatten(catalog)].filter((entry): entry is [string, string] => typeof entry[1] === "string")
}

function icuProblems(catalog: Catalog): string[] {
  return messages(catalog).flatMap(([path, value]) => {
    try {
      parse(value)
      return []
    } catch (error) {
      return [`${path}: invalid ICU — ${(error as Error).message}`]
    }
  })
}

/**
 * Placeholder signature of a message: argument names paired with how they are
 * used. `{count, plural, ...}` in one locale and `{count}` in another parses
 * and renders, but silently drops the plural forms — so the kind is compared,
 * not just the name.
 */
function placeholders(ast: MessageFormatElement[], into = new Map<string, string>()): Map<string, string> {
  for (const element of ast) {
    switch (element.type) {
      case TYPE.argument:
      case TYPE.number:
      case TYPE.date:
      case TYPE.time:
        into.set(element.value, TYPE[element.type])
        break
      case TYPE.select:
      case TYPE.plural:
        into.set(element.value, TYPE[element.type])
        for (const option of Object.values(element.options)) placeholders(option.value, into)
        break
      case TYPE.tag:
        placeholders(element.children, into)
        break
      default:
        break
    }
  }
  return into
}

function placeholderProblems(catalog: Catalog, reference: Catalog): string[] {
  const referenceLeaves = flatten(reference)
  return messages(catalog).flatMap(([path, value]) => {
    const expected = referenceLeaves.get(path)
    if (typeof expected !== "string") return []

    const actual = placeholders(parse(value))
    const wanted = placeholders(parse(expected))
    return [
      ...[...wanted].flatMap(([name, kind]) =>
        !actual.has(name)
          ? [`${path}: missing placeholder {${name}}`]
          : actual.get(name) !== kind
            ? [`${path}: {${name}} is a ${actual.get(name)}, "${DEFAULT_LOCALE}" has a ${kind}`]
            : []
      ),
      ...[...actual.keys()]
        .filter((name) => !wanted.has(name))
        .map((name) => `${path}: unknown placeholder {${name}}`),
    ]
  })
}

/** The plural categories a language distinguishes for cardinal counts. */
function pluralCategories(formattingLocale: string): Set<string> {
  const rules = new Intl.PluralRules(formattingLocale)
  // 0-200 covers every category CLDR distinguishes for the languages in use.
  return new Set(Array.from({ length: 201 }, (_, n) => rules.select(n)))
}

function pluralBlocks(
  ast: MessageFormatElement[],
  out: { argument: string; options: string[] }[] = []
): { argument: string; options: string[] }[] {
  for (const element of ast) {
    if (element.type === TYPE.plural) {
      out.push({ argument: element.value, options: Object.keys(element.options) })
    }
    if (element.type === TYPE.select || element.type === TYPE.plural) {
      for (const option of Object.values(element.options)) pluralBlocks(option.value, out)
    }
    if (element.type === TYPE.tag) pluralBlocks(element.children, out)
  }
  return out
}

function pluralProblems(catalog: Catalog, formattingLocale: string): string[] {
  const required = pluralCategories(formattingLocale)
  return messages(catalog).flatMap(([path, value]) =>
    pluralBlocks(parse(value)).flatMap(({ argument, options }) =>
      [...required]
        // `=0` and friends are exact matches, and satisfy the category too.
        .filter((category) => !options.includes(category) && !options.includes(`=${category}`))
        .map((category) => `${path}: plural on {${argument}} is missing the "${category}" form`)
    )
  )
}

function eachCatalog(
  check: (catalog: Catalog, reference: Catalog, locale: SupportedLocale) => string[]
): string[] {
  return SUPPORTED_LOCALES.flatMap((locale) =>
    MESSAGE_NAMESPACES.flatMap((namespace) =>
      check(
        getCatalog(locale, namespace) as Catalog,
        getCatalog(DEFAULT_LOCALE, namespace) as Catalog,
        locale
      ).map((problem) => `${locale}/${namespace}.json  ${problem}`)
    )
  )
}

describe("the shipped catalogs", () => {
  it("registers one for every locale and namespace", () => {
    const missing = SUPPORTED_LOCALES.flatMap((locale) =>
      MESSAGE_NAMESPACES.filter((namespace) => getCatalog(locale, namespace) === undefined).map(
        (namespace) => `${locale}/${namespace}.json`
      )
    )
    expect(missing).toEqual([])
  })

  it("has the same keys in every locale", () => {
    expect(eachCatalog(keyProblems)).toEqual([])
  })

  it("has no empty values", () => {
    expect(eachCatalog(valueProblems)).toEqual([])
  })

  it("parses every message as ICU", () => {
    expect(eachCatalog((catalog) => icuProblems(catalog))).toEqual([])
  })

  it("has the same placeholders in every locale, by name and kind", () => {
    expect(eachCatalog(placeholderProblems)).toEqual([])
  })

  it("covers every plural category each language uses", () => {
    expect(
      eachCatalog((catalog, _reference, locale) =>
        pluralProblems(catalog, getFormattingLocale(locale))
      )
    ).toEqual([])
  })
})

describe("the checks themselves", () => {
  // Without these, a future edit could disable a check and nothing would
  // notice: the real catalogs pass either way.
  const reference: Catalog = {
    actions: { save: "Sačuvaj", cancel: "Otkaži" },
    weekdays: ["Ned", "Pon"],
    pageOf: "Strana {page} od {total}",
    seats: "{count, plural, one {# mesto} few {# mesta} other {# mesta}}",
  }

  it("catches a missing key and an unknown one", () => {
    expect(keyProblems({ actions: { save: "Save" }, extra: "x" }, reference)).toEqual([
      "actions.cancel: missing",
      "weekdays: missing",
      "pageOf: missing",
      "seats: missing",
      "extra: not in \"sr\"",
    ])
  })

  it("catches an empty value and a resized array", () => {
    expect(valueProblems({ actions: { save: "   " }, weekdays: ["Sun"] }, reference)).toEqual([
      "actions.save: is empty",
      "weekdays: has 1 entries, \"sr\" has 2",
    ])
  })

  it("catches a malformed message", () => {
    expect(icuProblems({ broken: "{count, plural, one {#}}" })).toHaveLength(1)
  })

  it("catches a dropped argument", () => {
    expect(placeholderProblems({ pageOf: "Page {page}" }, reference)).toEqual([
      "pageOf: missing placeholder {total}",
    ])
  })

  it("catches an argument that stopped being a plural", () => {
    expect(placeholderProblems({ seats: "{count} seats" }, reference)).toEqual([
      "seats: {count} is a argument, \"sr\" has a plural",
    ])
  })

  it("catches a plural missing a form the language needs", () => {
    const withoutFew = { seats: "{count, plural, one {# mesto} other {# mesta}}" }
    expect(pluralProblems(withoutFew, getFormattingLocale("sr"))).toEqual([
      'seats: plural on {count} is missing the "few" form',
    ])
    // English has no "few", so the same message is fine there.
    expect(pluralProblems(withoutFew, getFormattingLocale("en"))).toEqual([])
  })
})
