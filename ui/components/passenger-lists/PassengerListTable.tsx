"use client"

import { cn } from "@/lib/utils"
import { PASSENGER_LIST_HEADERS, type PassengerListRow } from "@/utils/passengerListHelpers"

interface PassengerListTableProps {
  heading: string
  rows: PassengerListRow[]
}

/**
 * The passenger list as it is printed and exported: a dark title row stating
 * the day and the seat usage, then seat, group, passenger, route, date, phone
 * and the return-leg info. Drivers read this next to the paper sheet, so the
 * column order and the emphasis mirror the PDF instead of the app's table style.
 */
export function PassengerListTable({ heading, rows }: PassengerListTableProps) {
  return (
    <div className="space-y-3">
      <div className="rounded-t-md bg-[#1a2033] px-4 py-3 text-center text-sm font-bold uppercase tracking-wide text-white sm:text-base">
        {heading}
      </div>

      {/* Desktop: the printed grid, one row per seat. */}
      <div className="hidden overflow-x-auto border border-foreground/70 md:block">
        <table className="w-full border-collapse text-center text-sm">
          <thead>
            <tr className="bg-[#1a2033] text-white">
              {PASSENGER_LIST_HEADERS.map((header) => (
                <th
                  key={header}
                  className="border border-foreground/70 px-2 py-2 text-xs font-bold uppercase tracking-wide"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={`${row.seatNumber}-${index}`}
                className={cn(row.hasGroup && "bg-muted/60")}
              >
                <td className="border border-foreground/70 px-2 py-1.5 font-bold tabular-nums">
                  {row.seatNumber}
                </td>
                <td className="border border-foreground/70 px-2 py-1.5 font-bold text-[#c00000]">
                  {row.groupLabel}
                </td>
                <td className="border border-foreground/70 px-2 py-1.5 text-left">
                  {row.passengerName}
                </td>
                <td className="border border-foreground/70 px-2 py-1.5">
                  {row.departureStation}
                </td>
                <td className="border border-foreground/70 px-2 py-1.5">{row.arrivalStation}</td>
                <td className="border border-foreground/70 px-2 py-1.5 tabular-nums">
                  {row.date}
                </td>
                <td className="border border-foreground/70 px-2 py-1.5 tabular-nums">
                  {row.phone}
                </td>
                <td className="border border-foreground/70 px-2 py-1.5 whitespace-nowrap">
                  {row.info}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: the same fields stacked, seat number kept prominent. */}
      <div className="space-y-2 md:hidden">
        {rows.map((row, index) => (
          <div
            key={`${row.seatNumber}-${index}`}
            className={cn(
              "rounded-lg border border-foreground/70 p-3",
              row.hasGroup && "bg-muted/60"
            )}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#1a2033] text-sm font-bold tabular-nums text-white">
                {row.seatNumber}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-tight">{row.passengerName}</p>
                {row.phone && (
                  <a
                    href={`tel:${row.phone.replace(/\s+/g, "")}`}
                    className="text-sm tabular-nums text-primary underline-offset-2 hover:underline"
                  >
                    {row.phone}
                  </a>
                )}
              </div>
              {row.groupLabel && (
                <span className="shrink-0 text-sm font-bold text-[#c00000]">
                  {row.groupLabel}
                </span>
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Polazak</p>
                <p>{row.departureStation}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Dolazak</p>
                <p>{row.arrivalStation}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Datum</p>
                <p className="tabular-nums">{row.date}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Info</p>
                <p className="font-medium">{row.info}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
