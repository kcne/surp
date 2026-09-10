"use client"

import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ALL_RIDES_OPTION, type RideFilterOption } from "@/hooks/usePassengerListsPage"

interface PassengerListFiltersProps {
  rideOptions: RideFilterOption[]
  selectedRideId: string
  onSelectedRideIdChange: (rideId: string) => void
  fromDate: string
  onFromDateChange: (date: string) => void
  toDate: string
  onToDateChange: (date: string) => void
  onReset: () => void
  hasActiveFilters: boolean
  resultCount: number
}

export function PassengerListFilters({
  rideOptions,
  selectedRideId,
  onSelectedRideIdChange,
  fromDate,
  onFromDateChange,
  toDate,
  onToDateChange,
  onReset,
  hasActiveFilters,
  resultCount,
}: PassengerListFiltersProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
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
          <Label htmlFor="passenger-list-from">Od datuma</Label>
          <Input
            id="passenger-list-from"
            type="date"
            value={fromDate}
            onChange={(event) => onFromDateChange(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="passenger-list-to">Do datuma</Label>
          <Input
            id="passenger-list-to"
            type="date"
            value={toDate}
            onChange={(event) => onToDateChange(event.target.value)}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Prikazano vožnji: <span className="font-medium text-foreground">{resultCount}</span>
        </p>
        {hasActiveFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Poništi filtere
          </Button>
        )}
      </div>
    </div>
  )
}
