"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Ban, ChevronDown, Info, RotateCcw, Users } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import type { Reservation } from "@/types"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { reservationsControllerCancellationPreview } from "@/infrastructure/generated/surp-api"
import { toReservation } from "@/infrastructure/mappers/reservationMappers"

function PassengerSeats({ items, muted = false }: { items: Reservation[]; muted?: boolean }) {
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((item) => (
        <li key={item.id} className={muted ? "text-muted-foreground" : ""}>
          <span className="mr-2 inline-flex min-w-8 justify-center rounded bg-muted px-1.5 py-0.5 text-xs font-bold tabular-nums">
            #{item.seatNumber}
          </span>
          <span className="font-medium">
            {item.passenger.firstName} {item.passenger.lastName}
          </span>
          {item.passenger.phone && (
            <span className="ml-2 text-xs text-muted-foreground tabular-nums">
              {item.passenger.phone}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

function SeatChips({ seats, tone = "default" }: { seats: number[]; tone?: "default" | "danger" }) {
  return (
    <span className="mt-1.5 flex flex-wrap gap-1">
      {seats.map((seat) => (
        <span
          key={seat}
          className={
            tone === "danger"
              ? "rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger tabular-nums"
              : "rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary tabular-nums"
          }
        >
          #{seat}
        </span>
      ))}
    </span>
  )
}

export function BulkReservationCancelDialog({
  open,
  onOpenChange,
  selected,
  reservations,
  labels,
  loading,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  selected: Reservation[]
  reservations: Reservation[]
  labels: Map<string, string>
  loading?: boolean
  onConfirm: (items: Reservation[]) => void
}) {
  const [scope, setScope] = useState<"selected" | "groups">("selected")
  const [includeReturn, setIncludeReturn] = useState(true)
  const [isFinalConfirmationOpen, setIsFinalConfirmationOpen] = useState(false)
  const groups = useMemo(
    () =>
      [...new Set(selected.map((item) => item.groupId).filter(Boolean))].map((id) => ({
        id: id!,
        items: reservations.filter((item) => item.status === "active" && item.groupId === id),
      })),
    [selected, reservations]
  )
  const items =
    scope === "groups"
      ? Array.from(
          new Map(
            [...selected, ...groups.flatMap((group) => group.items)].map((item) => [item.id, item])
          ).values()
        )
      : selected
  const selectedSeatNumbers = selected
    .map((item) => item.seatNumber)
    .sort((left, right) => left - right)
  const groupSeatNumbers = Array.from(
    new Set([...selected, ...groups.flatMap((group) => group.items)].map((item) => item.seatNumber))
  ).sort((left, right) => left - right)
  const previewQuery = useQuery({
    queryKey: [
      "reservations",
      "cancellation-preview",
      selected.map((item) => item.id).sort(),
      scope,
    ],
    enabled: open && selected.length > 0,
    queryFn: async () => {
      const response = await reservationsControllerCancellationPreview({
        reservationIds: selected.map((item) => item.id),
        scope,
      })
      if (response.status !== 200) throw new Error("Nije moguće učitati pregled otkazivanja")
      return response.data
    },
  })
  const returnReservations = useMemo(
    () => previewQuery.data?.returnReservations.map((item) => toReservation(item)) ?? [],
    [previewQuery.data]
  )

  const reservationsToCancel =
    includeReturn && returnReservations.length > 0 ? [...items, ...returnReservations] : items
  const actionLabel =
    includeReturn && returnReservations.length > 0 ? "Otkaži oba smera" : "Otkaži samo ovaj smer"
  const fullGroupsToCancel = groups.filter((group) =>
    group.items.every((item) => items.some((chosen) => chosen.id === item.id))
  )
  const partialReservationsToCancel = items.filter(
    (item) =>
      !fullGroupsToCancel.some((group) => group.items.some((groupItem) => groupItem.id === item.id))
  )
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Proverite otkazivanje</AlertDialogTitle>
          <AlertDialogDescription>
            Izabrali ste {selected.length} rezervacija. Grupe ispod jasno pokazuju šta još može biti
            obuhvaćeno.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3">
          {groups.map((group) => {
            const chosen = group.items.filter((item) => selected.some((s) => s.id === item.id))
            const rest = group.items.filter((item) => !selected.some((s) => s.id === item.id))
            return (
              <div key={group.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center gap-2 font-semibold">
                  <Users className="h-4 w-4 text-primary" />
                  {labels.get(group.id) ?? "Grupa"}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({group.items.length} sedišta)
                  </span>
                </div>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide">Izabrano</p>
                <PassengerSeats items={chosen} />
                {rest.length > 0 && (
                  <>
                    <p className="mt-3 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Info className="h-3.5 w-3.5" />
                      Nije izabrano
                    </p>
                    <PassengerSeats items={rest} muted />
                  </>
                )}
              </div>
            )
          })}
        </div>
        {groups.some(
          (group) =>
            group.items.length >
            group.items.filter((item) => selected.some((s) => s.id === item.id)).length
        ) && (
          <RadioGroup value={scope} onValueChange={(value) => setScope(value as typeof scope)}>
            <div className="flex gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <RadioGroupItem value="selected" id="selected" className="mt-0.5" />
              <Label htmlFor="selected" className="cursor-pointer">
                <span className="block font-semibold">Otkaži samo izabrana sedišta</span>
                <SeatChips seats={selectedSeatNumbers} />
              </Label>
            </div>
            <div className="mt-2 flex gap-3 rounded-lg border border-danger/30 bg-danger/5 p-3">
              <RadioGroupItem
                value="groups"
                id="groups"
                className="mt-0.5 border-danger text-danger"
              />
              <Label htmlFor="groups" className="cursor-pointer">
                <span className="block font-semibold text-danger">
                  Otkaži izabrana sedišta i cele njihove grupe
                </span>
                <SeatChips seats={groupSeatNumbers} tone="danger" />
              </Label>
            </div>
          </RadioGroup>
        )}
        {returnReservations.length > 0 && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
            <div className="flex items-center gap-2 font-semibold text-primary">
              <RotateCcw className="h-4 w-4" />
              Pronađene su {returnReservations.length} povratne rezervacije
            </div>
            <p className="mt-1 text-muted-foreground">
              Podrazumevana akcija ih otkazuje zajedno sa ovim smerom.
            </p>
            <PassengerSeats items={returnReservations} />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Nazad</AlertDialogCancel>
          <div className="flex overflow-hidden rounded-md">
            <Button
              variant="destructive"
              className="rounded-r-none"
              disabled={loading}
              onClick={() => setIsFinalConfirmationOpen(true)}
            >
              <Ban className="h-4 w-4" />
              {actionLabel} ({reservationsToCancel.length})
            </Button>
            {returnReservations.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="destructive"
                    className="rounded-l-none border-l border-white/40 px-2 hover:border-white/60"
                    aria-label="Dodatne opcije otkazivanja"
                  >
                    <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setIncludeReturn(false)}>
                    Otkaži samo ovaj smer
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setIncludeReturn(true)}>
                    Otkaži oba smera
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
      <AlertDialog open={isFinalConfirmationOpen} onOpenChange={setIsFinalConfirmationOpen}>
        <AlertDialogContent className="max-h-[80dvh] max-w-md overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>{actionLabel}?</AlertDialogTitle>
            <AlertDialogDescription>Ova akcija se ne može poništiti.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <p className="text-sm font-semibold">Ovom akcijom otkazujete:</p>
            {fullGroupsToCancel.map((group) => (
              <div
                key={group.id}
                className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm"
              >
                <div className="flex items-center gap-2 font-semibold text-danger">
                  <Users className="h-4 w-4" />
                  {labels.get(group.id) ?? "Grupa"}{" "}
                  <span className="font-normal">({group.items.length} sedišta)</span>
                </div>
                <PassengerSeats items={group.items} />
              </div>
            ))}
            {partialReservationsToCancel.length > 0 && (
              <div className="rounded-lg border p-3 text-sm">
                <p className="font-semibold">Izabrane rezervacije</p>
                <PassengerSeats items={partialReservationsToCancel} />
              </div>
            )}
            {includeReturn && returnReservations.length > 0 && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                <div className="flex items-center gap-2 font-semibold text-primary">
                  <RotateCcw className="h-4 w-4" />
                  Povratni smer
                </div>
                <PassengerSeats items={returnReservations} />
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Nazad</AlertDialogCancel>
            <AlertDialogAction
              disabled={loading}
              className="bg-danger text-white hover:bg-danger/90"
              onClick={(event) => {
                event.preventDefault()
                setIsFinalConfirmationOpen(false)
                onOpenChange(false)
                onConfirm(reservationsToCancel)
              }}
            >
              <Ban className="mr-2 h-4 w-4" />
              {loading ? "Otkazivanje..." : actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AlertDialog>
  )
}
