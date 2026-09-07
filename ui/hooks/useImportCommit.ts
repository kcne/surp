"use client"

import { useCallback, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  passengersControllerCreate,
  reservationsControllerCreateBatch,
} from "@/infrastructure/generated/surp-api"
import { toCreatePassengerDto, toPassenger } from "@/infrastructure/mappers/passengerMappers"
import { toCreateReservationDto } from "@/infrastructure/mappers/reservationMappers"
import { reservationsByRideInstanceQueryKey } from "@/infrastructure/hooks/queries/useReservationsByRideInstanceQuery"
import { normalizeKey } from "@/lib/csv-import"
import type {
  BatchReservationsResponseDto,
  PassengerResponseDto,
} from "@/infrastructure/generated/model"
import type { ImportRowState } from "@/lib/csv-import"
import type { RideInstance } from "@/types"

/** The API caps a reservation batch at 50 items. */
const MAX_BATCH_SIZE = 50

export interface ImportCommitFailure {
  /** Unset when the failure happened before reservations were reached. */
  rideInstanceId?: string
  rowIds: string[]
  message: string
}

export interface ImportCommitResult {
  createdPassengerCount: number
  createdReservationCount: number
  importedRowIds: string[]
  failures: ImportCommitFailure[]
}

interface UseImportCommitOptions {
  rideInstancesById: Record<string, RideInstance>
  /**
   * Called with the passenger id now backing each row, as soon as those
   * passengers exist — including when the import later fails. Passenger
   * creation is not transactional, so a retry that did not know about the
   * passengers already created would create the same people a second time.
   */
  onPassengersLinked: (passengerIdByRowId: Record<string, string>) => void
  onCompleted: (result: ImportCommitResult) => void
}

function isSuccess(response: { status: number }): boolean {
  return response.status >= 200 && response.status < 300
}

/** Same person across rows: identical name plus identical phone. */
function passengerDedupeKey(row: ImportRowState): string {
  return [
    normalizeKey(row.firstName),
    normalizeKey(row.lastName),
    row.phone.replace(/\D/g, ""),
  ].join("#")
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export function useImportCommit({
  rideInstancesById,
  onPassengersLinked,
  onCompleted,
}: UseImportCommitOptions) {
  const queryClient = useQueryClient()
  const [isCommitting, setIsCommitting] = useState(false)

  const commit = useCallback(
    async (rows: ImportRowState[]) => {
      if (rows.length === 0) {
        return
      }

      setIsCommitting(true)

      // Every passenger created so far, keyed by the row it belongs to. Reported
      // to the caller whether or not the rest of the import succeeds, so a retry
      // reuses these people instead of creating them again.
      const passengerIdByRowId: Record<string, string> = {}
      let createdPassengerCount = 0

      const publishCreatedPassengers = () => {
        if (createdPassengerCount === 0) {
          return
        }

        queryClient.invalidateQueries({ queryKey: ["passengers"] })
        onPassengersLinked(passengerIdByRowId)
      }

      try {
        // 1. Create every passenger the import needs, once per distinct person.
        // A CSV line and its return leg share one passenger, as do repeated
        // group bookings under the same name and phone.
        const passengerIdByDedupeKey = new Map<string, string>()
        let passengerError: string | null = null

        for (const row of rows) {
          if (row.passengerId) {
            continue
          }

          const dedupeKey = passengerDedupeKey(row)
          const alreadyCreated = passengerIdByDedupeKey.get(dedupeKey)

          if (alreadyCreated) {
            passengerIdByRowId[row.id] = alreadyCreated
            continue
          }

          try {
            const response = await passengersControllerCreate(
              toCreatePassengerDto({
                firstName: row.firstName,
                lastName: row.lastName,
                phone: row.phone,
                passengerType: "odrasli",
              })
            )

            if (!isSuccess(response)) {
              throw new Error(
                `Neuspesno kreiranje putnika ${row.firstName} ${row.lastName} (red ${row.source.lineNumber})`
              )
            }

            const created = toPassenger(response.data as PassengerResponseDto)
            passengerIdByDedupeKey.set(dedupeKey, created.id)
            passengerIdByRowId[row.id] = created.id
            createdPassengerCount += 1
          } catch (error) {
            passengerError = getErrorMessage(
              error,
              `Neuspesno kreiranje putnika ${row.firstName} ${row.lastName} (red ${row.source.lineNumber})`
            )
            break
          }
        }

        // Stop before booking anything: without every passenger, the remaining
        // rows would import against the wrong people or not at all. The ones
        // already created are handed back so the retry picks them up.
        if (passengerError) {
          publishCreatedPassengers()
          toast.error(passengerError)
          onCompleted({
            createdPassengerCount,
            createdReservationCount: 0,
            importedRowIds: [],
            failures: [{ rowIds: rows.map((row) => row.id), message: passengerError }],
          })
          return
        }

        const importedRowIds: string[] = []
        const failures: ImportCommitFailure[] = []
        let createdReservationCount = 0

        // 2. Create reservations grouped by ride instance, since a batch call
        // is scoped to a single ride, date and departure time.
        const rowsByRideInstanceId = new Map<string, ImportRowState[]>()
        rows.forEach((row) => {
          if (!row.rideInstanceId) {
            return
          }

          const passengerId = row.passengerId ?? passengerIdByRowId[row.id]

          // Cannot happen once the passenger phase completed, but booking a
          // reservation against an empty passenger id would fail deep in the
          // API with an unrelated message.
          if (!passengerId) {
            failures.push({
              rowIds: [row.id],
              message: `Putnik nije kreiran za red ${row.source.lineNumber}`,
            })
            return
          }

          rowsByRideInstanceId.set(row.rideInstanceId, [
            ...(rowsByRideInstanceId.get(row.rideInstanceId) ?? []),
            row,
          ])
        })

        const resolvePassengerId = (row: ImportRowState): string =>
          row.passengerId ?? passengerIdByRowId[row.id]

        for (const [rideInstanceId, rideRows] of Array.from(rowsByRideInstanceId.entries())) {
          const rideInstance = rideInstancesById[rideInstanceId]
          if (!rideInstance) {
            failures.push({
              rideInstanceId,
              rowIds: rideRows.map((row) => row.id),
              message: "Voznja vise nije dostupna",
            })
            continue
          }

          for (const batchRows of chunk(rideRows, MAX_BATCH_SIZE)) {
            try {
              const response = await reservationsControllerCreateBatch({
                items: batchRows.map((row) =>
                  toCreateReservationDto(
                    {
                      rideInstanceId,
                      passengerId: resolvePassengerId(row),
                      seatNumber: row.seatNumber ?? 0,
                      departureStationId: row.departureStationId ?? "",
                      arrivalStationId: row.arrivalStationId ?? "",
                      notes: row.notes,
                    },
                    rideInstance
                  )
                ),
                travelTogether: false,
              })

              if (!isSuccess(response)) {
                throw new Error("Neuspesno kreiranje rezervacija")
              }

              // The batch endpoint runs in one transaction: it either creates
              // every item or rolls the whole batch back. The per-item check
              // guards that contract — if it ever reports a partial result,
              // the rows below would be marked imported without existing.
              const batchResponse = response.data as BatchReservationsResponseDto
              const failedItem = batchResponse.items.find((item) => !item.success)

              if (failedItem) {
                throw new Error(failedItem.error?.message ?? "Neuspesno kreiranje rezervacija")
              }

              createdReservationCount += batchResponse.createdCount
              importedRowIds.push(...batchRows.map((row) => row.id))
            } catch (error) {
              failures.push({
                rideInstanceId,
                rowIds: batchRows.map((row) => row.id),
                message: getErrorMessage(error, "Neuspesno kreiranje rezervacija"),
              })
            }
          }

          queryClient.invalidateQueries({
            queryKey: reservationsByRideInstanceQueryKey(rideInstanceId),
          })
        }

        queryClient.invalidateQueries({ queryKey: ["reservations"] })
        publishCreatedPassengers()

        const failedRowCount = failures.reduce(
          (count, failure) => count + failure.rowIds.length,
          0
        )

        if (failedRowCount === 0) {
          toast.success(`Uvezeno ${createdReservationCount} rezervacija`)
        } else {
          toast.error(
            `Uvezeno ${createdReservationCount} rezervacija, ${failedRowCount} redova nije uspelo`
          )
        }

        onCompleted({
          createdPassengerCount,
          createdReservationCount,
          importedRowIds,
          failures,
        })
      } catch (error) {
        publishCreatedPassengers()
        toast.error(getErrorMessage(error, "Uvoz nije uspeo"))
      } finally {
        setIsCommitting(false)
      }
    },
    [onCompleted, onPassengersLinked, queryClient, rideInstancesById]
  )

  return { commit, isCommitting }
}
