"use client"

import { useState, useEffect } from "react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Check, ChevronsUpDown, User, UserPlus } from "lucide-react"
import { cn } from "@/lib/utils"
import { usePassengersStore } from "@/stores/passengersStore"
import type { Passenger } from "@/types"
import { formatPassengerName } from "@/utils/formatters"

interface PassengerSearchProps {
  value?: Passenger | null
  onSelect: (passenger: Passenger | null) => void
  onAddNew?: () => void
}

export function PassengerSearch({ value, onSelect, onAddNew }: PassengerSearchProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const { searchPassengers, searchResults, loading, passengers } = usePassengersStore()

  // Search when popover is open and query/passengers change
  useEffect(() => {
    if (open) {
      searchPassengers(searchQuery)
    }
  }, [open, searchQuery, passengers.length, searchPassengers])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value
            ? formatPassengerName(value.firstName, value.lastName)
            : "Pretraži putnika..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[400px] max-h-[70vh] overflow-hidden p-0"
        align="start"
        onWheelCapture={(event) => event.stopPropagation()}
        onTouchMoveCapture={(event) => event.stopPropagation()}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Pretraži po imenu, prezimenu, telefonu..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList
            className="max-h-[260px] overflow-y-auto overscroll-contain touch-pan-y"
            onWheelCapture={(event) => event.stopPropagation()}
            onTouchMoveCapture={(event) => event.stopPropagation()}
          >
            <CommandEmpty>
              {loading ? (
                "Pretraga..."
              ) : searchQuery.length < 1 && searchResults.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-4">
                  <p>Nema sačuvanih putnika</p>
                  {onAddNew && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onAddNew()
                        setOpen(false)
                      }}
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Dodaj Novog Putnika
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-4">
                  <p>Nema rezultata za &quot;{searchQuery}&quot;</p>
                  {onAddNew && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onAddNew()
                        setOpen(false)
                      }}
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Dodaj Novog Putnika
                    </Button>
                  )}
                </div>
              )}
            </CommandEmpty>
            <CommandGroup>
              {searchResults.map((passenger) => (
                <CommandItem
                  key={passenger.id}
                  value={`${passenger.firstName} ${passenger.lastName} ${passenger.phone} ${passenger.email || ""}`}
                  onSelect={() => {
                    onSelect(passenger)
                    setOpen(false)
                    setSearchQuery("")
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value?.id === passenger.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {formatPassengerName(passenger.firstName, passenger.lastName)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            {onAddNew && searchQuery.length >= 2 && (
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    onAddNew()
                    setOpen(false)
                  }}
                  className="text-primary"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Dodaj Novog Putnika: {searchQuery}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

