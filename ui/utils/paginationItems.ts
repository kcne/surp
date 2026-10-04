/** A gap of two or more pages between the page buttons. */
export const PAGINATION_ELLIPSIS = "ellipsis" as const

export type PaginationItem = number | typeof PAGINATION_ELLIPSIS

/**
 * The page buttons to draw, as zero-based page indexes and gaps. The first and
 * last page, and `siblings` pages either side of the current one, are always
 * listed. Every list for the same page count has the same length, so the
 * buttons don't shift as the user pages through, and a gap always hides at
 * least two pages; a single hidden page is shown instead.
 */
export function getPaginationItems(
  pageIndex: number,
  pageCount: number,
  siblings = 2
): PaginationItem[] {
  if (pageCount <= 0) {
    return []
  }

  // First, last, current, siblings either side, and two gaps.
  const slots = 2 * siblings + 5
  if (pageCount <= slots) {
    return range(0, pageCount - 1)
  }

  const current = Math.min(Math.max(pageIndex, 0), pageCount - 1)
  const last = pageCount - 1
  // Pages shown next to the single gap when the current page is near an end.
  const edgeRun = slots - 2

  if (current < siblings + 3) {
    return [...range(0, edgeRun - 1), PAGINATION_ELLIPSIS, last]
  }

  if (current > last - siblings - 3) {
    return [0, PAGINATION_ELLIPSIS, ...range(pageCount - edgeRun, last)]
  }

  return [
    0,
    PAGINATION_ELLIPSIS,
    ...range(current - siblings, current + siblings),
    PAGINATION_ELLIPSIS,
    last,
  ]
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index)
}
