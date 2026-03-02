"use client"

import { useMemo, useState } from "react"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import type { RideInstance } from "@/types"

interface CalendarViewProps {
  selectedDate: Date | undefined
  onDateSelect: (date: Date | undefined) => void
  rideInstances: RideInstance[]
}

export function CalendarView({
  selectedDate,
  onDateSelect,
  rideInstances,
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  void rideInstances


  const handleMonthChange = (date: Date) => {
    setCurrentMonth(date)
  }

  const currentMonthLabel = useMemo(() => format(currentMonth, "MMMM yyyy"), [currentMonth])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Kalendar</h2>
          <p className="text-xs text-muted-foreground">Izaberite datum vožnje</p>
        </div>
        <Badge variant="secondary" className="text-xs">
          {currentMonthLabel}
        </Badge>
      </div>

      <div className="rounded-lg border bg-card/50 p-3 shadow-sm">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={onDateSelect}
          month={currentMonth}
          onMonthChange={handleMonthChange}
          className="w-full"
          classNames={{
            root: "w-full",
            months: "flex flex-col space-y-3",
            month: "space-y-2",
            month_caption: "flex items-center justify-center gap-2 text-sm font-semibold",
            nav: "absolute inset-x-0 top-0 flex items-center justify-between",
            button_previous: "h-7 w-7",
            button_next: "h-7 w-7",
            caption_label: "text-sm font-semibold",
            table: "w-full border-collapse",
            head_row: "flex",
            head_cell: "text-muted-foreground rounded-md w-8 text-[0.7rem] font-medium",
            row: "flex w-full mt-1.5",
            cell: "h-8 w-8 text-center text-xs p-0 relative focus-within:z-20",
            day: cn("h-8 w-8 p-0 text-xs font-medium aria-selected:opacity-100"),
            day_selected:
              "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
            day_today: "bg-accent text-accent-foreground",
            day_outside:
              "day-outside text-muted-foreground opacity-40 aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
            day_disabled: "text-muted-foreground opacity-40",
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded border-2 bg-success/20 border-success" />
          <span>Dostupno</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded border-2 bg-warning/20 border-warning" />
          <span>Ograničeno</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded border-2 bg-danger/20 border-danger" />
          <span>Popunjeno</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded border-2 bg-gray-100 border-gray-300" />
          <span>Nema vožnji</span>
        </div>
      </div>
    </div>
  )
}
