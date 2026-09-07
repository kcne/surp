"use client"

import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { StationListItem } from "@/infrastructure/hooks/queries/useStationsListQuery"

interface StationComboboxProps {
  value: string | null
  stations: StationListItem[]
  /** Ranked suggestion ids, shown above the full list. */
  suggestedIds?: string[]
  placeholder: string
  invalid?: boolean
  onChange: (stationId: string) => void
}

export function StationCombobox({
  value,
  stations,
  suggestedIds = [],
  placeholder,
  invalid,
  onChange,
}: StationComboboxProps) {
  const [open, setOpen] = useState(false)

  const selected = stations.find((station) => station.id === value)
  const suggested = suggestedIds
    .map((id) => stations.find((station) => station.id === id))
    .filter((station): station is StationListItem => Boolean(station))

  const renderItem = (station: StationListItem) => (
    <CommandItem
      key={station.id}
      value={`${station.name} ${station.address}`}
      onSelect={() => {
        onChange(station.id)
        setOpen(false)
      }}
    >
      <Check
        className={cn("mr-2 h-4 w-4", station.id === value ? "opacity-100" : "opacity-0")}
      />
      <span className="truncate">
        {station.name}
        {station.address ? (
          <span className="ml-2 text-xs text-muted-foreground">{station.address}</span>
        ) : null}
      </span>
    </CommandItem>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-8 w-full justify-between px-2 text-left text-sm font-normal",
            !selected && "text-muted-foreground",
            invalid && "border-destructive text-destructive"
          )}
        >
          <span className="truncate">{selected?.name ?? placeholder}</span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Pretrazi stanicu..." />
          <CommandList>
            <CommandEmpty>Nema stanice.</CommandEmpty>

            {suggested.length > 0 ? (
              <CommandGroup heading="Predlozi">{suggested.map(renderItem)}</CommandGroup>
            ) : null}

            <CommandGroup heading="Sve stanice">{stations.map(renderItem)}</CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
