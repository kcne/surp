"use client"

import { useState } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, X, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { useStationsListQuery } from "@/infrastructure/hooks/queries/useStationsListQuery"
import type { StationListItem } from "@/infrastructure/hooks/queries/useStationsListQuery"
import type { LineFormStop } from "@/types"
import { cn } from "@/lib/utils"

interface IntermediateStationsListProps {
  stops: LineFormStop[]
  onChange: (stops: LineFormStop[]) => void
  departureStationId?: string
  arrivalStationId?: string
}

interface SortableStationItemProps {
  stationId: string
  stationName: string
  isBoarding: boolean
  isDropoff: boolean
  onToggleBoarding: (checked: boolean) => void
  onToggleDropoff: (checked: boolean) => void
  onRemove: () => void
}

function SortableStationItem({
  stationId,
  stationName,
  isBoarding,
  isDropoff,
  onToggleBoarding,
  onToggleDropoff,
  onRemove,
}: SortableStationItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stationId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-white p-3",
        isDragging && "shadow-lg"
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <span className="flex-1 font-medium">{stationName}</span>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={isBoarding}
          onCheckedChange={(checked) => onToggleBoarding(checked === true)}
        />
        Polazna
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={isDropoff}
          onCheckedChange={(checked) => onToggleDropoff(checked === true)}
        />
        Dolazna
      </label>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="h-8 w-8 text-danger hover:text-danger hover:bg-danger/10"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function IntermediateStationsList({
  stops,
  onChange,
  departureStationId,
  arrivalStationId,
}: IntermediateStationsListProps) {
  const stationsQuery = useStationsListQuery()
  const stations = stationsQuery.data || []
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const selectedStationIds = stops.map((stop) => stop.stationId)

  // Filter out already selected stations and departure/arrival stations
  const availableStations = stations.filter(
    (station) =>
      !selectedStationIds.includes(station.id) &&
      station.id !== departureStationId &&
      station.id !== arrivalStationId
  )

  const selectedStations = stops
    .map((stop) => {
      const station = stations.find((s) => s.id === stop.stationId)
      return station ? { stop, station } : null
    })
    .filter((entry): entry is { stop: LineFormStop; station: StationListItem } => !!entry)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = selectedStationIds.indexOf(active.id as string)
      const newIndex = selectedStationIds.indexOf(over.id as string)

      onChange(arrayMove(stops, oldIndex, newIndex))
    }
  }

  const handleAddStation = (stationId: string) => {
    // New stops serve both directions, which matches how stops behaved before
    // boarding rules existed.
    onChange([...stops, { stationId, isBoarding: true, isDropoff: true }])
    setIsPopoverOpen(false)
  }

  const handleRemoveStation = (stationId: string) => {
    onChange(stops.filter((stop) => stop.stationId !== stationId))
  }

  const handleToggleStop = (
    stationId: string,
    key: "isBoarding" | "isDropoff",
    checked: boolean
  ) => {
    onChange(
      stops.map((stop) =>
        stop.stationId === stationId ? { ...stop, [key]: checked } : stop
      )
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Međustanice</label>
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={availableStations.length === 0}
            >
              <Plus className="mr-2 h-4 w-4" />
              Dodaj Stanicu
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="end">
            <Command>
              <CommandInput placeholder="Pretraži stanice..." />
              <CommandList>
                <CommandEmpty>Nema dostupnih stanica</CommandEmpty>
                <CommandGroup>
                  {availableStations.map((station) => (
                    <CommandItem
                      key={station.id}
                      onSelect={() => handleAddStation(station.id)}
                    >
                      {station.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {selectedStations.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nema međustanica. Kliknite &quot;Dodaj Stanicu&quot; da dodate.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={selectedStationIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {selectedStations.map(({ stop, station }) => (
                <SortableStationItem
                  key={station.id}
                  stationId={station.id}
                  stationName={station.name}
                  isBoarding={stop.isBoarding}
                  isDropoff={stop.isDropoff}
                  onToggleBoarding={(checked) =>
                    handleToggleStop(station.id, "isBoarding", checked)
                  }
                  onToggleDropoff={(checked) =>
                    handleToggleStop(station.id, "isDropoff", checked)
                  }
                  onRemove={() => handleRemoveStation(station.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {selectedStations.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground">Redosled:</span>
          {selectedStations.map(({ station }, index) => (
            <Badge key={station.id} variant="outline" className="text-xs">
              {index + 1}. {station.name}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

