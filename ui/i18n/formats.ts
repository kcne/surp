import type { Formats } from "next-intl"

import { DEFAULT_CURRENCY } from "./tenant"

/**
 * Named format presets available to messages as `{value, date, long}` and to
 * `useFormatter()`. Keeping them here means a page cannot quietly invent its
 * own date style.
 */
export const formats = {
  dateTime: {
    short: { day: "2-digit", month: "2-digit", year: "numeric" },
    medium: { day: "numeric", month: "short", year: "numeric" },
    long: { day: "numeric", month: "long", year: "numeric" },
    // Schedules stay on a 24-hour clock in every locale.
    time: { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
    dateTime: {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    },
  },
  number: {
    currency: { style: "currency", currency: DEFAULT_CURRENCY },
    integer: { maximumFractionDigits: 0 },
    percent: { style: "percent", maximumFractionDigits: 1 },
  },
  list: {
    conjunction: { type: "conjunction", style: "long" },
    disjunction: { type: "disjunction", style: "long" },
  },
} satisfies Formats
