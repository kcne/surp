"use client"

import { useState } from "react"
import { format } from "date-fns"
import { srLatn } from "date-fns/locale"
import { CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ALL_RIDES_OPTION, type RideFilterOption } from "@/hooks/usePassengerListsPage"
import { formatDateToISO, parseISODate } from "@/utils/dateHelpers"

interface PassengerListFiltersProps {
  rideOptions: RideFilterOption[]
  selectedRideId: string
  onSelectedRideIdChange: (rideId: string) => void
  selectedDate: string
  onSelectedDateChange: (date: string) => void
  resultCount: number
}

export function PassengerListFilters({
  rideOptions,
  selectedRideId,
  onSelectedRideIdChange,
  selectedDate,
  onSelectedDateChange,
  resultCount,
}: PassengerListFiltersProps) {
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const selectedDateValue = selectedDate ? parseISODate(selectedDate) : undefined

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="passenger-list-ride">Vožnja</Label>
          <Select value={selectedRideId} onValueChange={onSelectedRideIdChange}>
            <SelectTrigger id="passenger-list-ride">
              <SelectValue placeholder="Sve vožnje" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_RIDES_OPTION}>Sve vožnje</SelectItem>
              {rideOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="passenger-list-date">Datum vožnje</Label>
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                id="passenger-list-date"
                type="button"
                variant="outline"
                className="h-12 w-full justify-between px-3 text-left text-base font-normal"
                aria-label="Izaberite datum vožnje"
              >
                {selectedDateValue ? format(selectedDateValue, "dd/MM/yy") : "Izaberite datum"}
                <CalendarDays className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDateValue}
                defaultMonth={selectedDateValue}
                locale={srLatn}
                initialFocus
                onSelect={(date) => {
                  if (!date) {
                    return
                  }

                  onSelectedDateChange(formatDateToISO(date))
                  setDatePickerOpen(false)
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-sm text-muted-foreground">
          Prikazano vožnji: <span className="font-medium text-foreground">{resultCount}</span>
        </p>
      </div>
    </div>
  )
}
