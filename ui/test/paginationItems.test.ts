import { describe, expect, it } from "vitest"
import { getPaginationItems, PAGINATION_ELLIPSIS as GAP } from "@/utils/paginationItems"

/**
 * A long table drew a button per page and pushed the page sideways under the
 * sidebar, so pagination lists the ends and the pages around the current one.
 */
describe("getPaginationItems", () => {
  it("lists every page when they all fit", () => {
    expect(getPaginationItems(0, 1)).toEqual([0])
    expect(getPaginationItems(4, 9)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
  })

  it("lists nothing for an empty table", () => {
    expect(getPaginationItems(0, 0)).toEqual([])
  })

  it("collapses at the smallest page counts that need a gap", () => {
    expect(getPaginationItems(4, 10)).toEqual([0, 1, 2, 3, 4, 5, 6, GAP, 9])
    expect(getPaginationItems(5, 10)).toEqual([0, GAP, 3, 4, 5, 6, 7, 8, 9])
    expect(getPaginationItems(4, 11)).toEqual([0, 1, 2, 3, 4, 5, 6, GAP, 10])
    expect(getPaginationItems(5, 11)).toEqual([0, GAP, 3, 4, 5, 6, 7, GAP, 10])
    expect(getPaginationItems(6, 11)).toEqual([0, GAP, 4, 5, 6, 7, 8, 9, 10])
  })

  it("collapses the tail near the first page", () => {
    expect(getPaginationItems(0, 42)).toEqual([0, 1, 2, 3, 4, 5, 6, GAP, 41])
    expect(getPaginationItems(4, 42)).toEqual([0, 1, 2, 3, 4, 5, 6, GAP, 41])
  })

  it("collapses both sides in the middle", () => {
    expect(getPaginationItems(5, 42)).toEqual([0, GAP, 3, 4, 5, 6, 7, GAP, 41])
    expect(getPaginationItems(20, 42)).toEqual([0, GAP, 18, 19, 20, 21, 22, GAP, 41])
  })

  it("collapses the head near the last page", () => {
    expect(getPaginationItems(41, 42)).toEqual([0, GAP, 35, 36, 37, 38, 39, 40, 41])
    expect(getPaginationItems(37, 42)).toEqual([0, GAP, 35, 36, 37, 38, 39, 40, 41])
  })

  it("keeps the same number of items on every page", () => {
    for (let pageCount = 10; pageCount <= 50; pageCount++) {
      for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
        expect(getPaginationItems(pageIndex, pageCount)).toHaveLength(9)
      }
    }
  })

  it("always shows the ends and the current page, and never hides a single page behind a gap", () => {
    for (let pageCount = 10; pageCount <= 50; pageCount++) {
      for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
        const items = getPaginationItems(pageIndex, pageCount)
        items.forEach((item, position) => {
          if (item !== GAP) return
          const before = items[position - 1] as number
          const after = items[position + 1] as number
          expect(after - before).toBeGreaterThan(2)
        })
        expect(items).toContain(pageIndex)
        expect(items[0]).toBe(0)
        expect(items[items.length - 1]).toBe(pageCount - 1)
      }
    }
  })

  it("clamps a page index outside the table", () => {
    expect(getPaginationItems(99, 42)).toEqual(getPaginationItems(41, 42))
    expect(getPaginationItems(-1, 42)).toEqual(getPaginationItems(0, 42))
  })
})
