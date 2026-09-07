"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  assignSeats,
  buildImportRows,
  buildPassengerIndex,
  findExistingPassenger,
  getStationAliases,
  resolveRideInstance,
  summarizeRows,
  validateImportRows,
  type ImportRow,
  type ImportRowState,
} from "@/lib/csv-import"
import { useRideInstancesByDatesQuery } from "@/infrastructure/hooks/queries/useRideInstancesByDatesQuery"
import { useRidesListQuery } from "@/infrastructure/hooks/queries/useRidesListQuery"
import { useStationsListQuery } from "@/infrastructure/hooks/queries/useStationsListQuery"
import { usePassengersListQuery } from "@/infrastructure/hooks/queries/usePassengersListQuery"
import { useReservationsByRideInstancesQuery } from "@/infrastructure/hooks/queries/useReservationsByRideInstanceQuery"
import { getTenantSlug } from "@/infrastructure/utils/storage"
import { useImportCommit, type ImportCommitResult } from "@/hooks/useImportCommit"
import type { RideInstance } from "@/types"

export interface ParseWarnings {
  fileName: string
  unmappedHeaders: string[]
  skippedLineNumbers: number[]
}

export function useReservationsImportPage() {
  const [rows, setRows] = useState<ImportRow[]>([])
  const [parseWarnings, setParseWarnings] = useState<ParseWarnings | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [commitResult, setCommitResult] = useState<ImportCommitResult | null>(null)

  const stationsQuery = useStationsListQuery()
  const ridesQuery = useRidesListQuery()
  const passengersQuery = usePassengersListQuery({ enabled: rows.length > 0 })

  const stations = useMemo(() => stationsQuery.data ?? [], [stationsQuery.data])
  const rides = useMemo(() => ridesQuery.data ?? [], [ridesQuery.data])
  const aliases = useMemo(() => getStationAliases(getTenantSlug()), [])

  const travelDates = useMemo(() => rows.map((row) => row.travelDate), [rows])
  const { rideInstancesByDate, rideInstancesById, isLoading: isLoadingRideInstances } =
    useRideInstancesByDatesQuery(travelDates, rides)

  // Ride instances actually referenced by a row, so seat availability is only
  // fetched for rides this import will touch.
  const referencedRideInstances = useMemo(() => {
    const referenced = new Map<string, RideInstance>()

    rows.forEach((row) => {
      const rideInstance = row.rideInstanceId ? rideInstancesById[row.rideInstanceId] : undefined
      if (rideInstance) {
        referenced.set(rideInstance.id, rideInstance)
      }
    })

    return Array.from(referenced.values())
  }, [rows, rideInstancesById])

  const { reservationsByRideInstanceId, isLoading: isLoadingReservations } =
    useReservationsByRideInstancesQuery(referencedRideInstances)

  const bookedSeatsByRideInstanceId = useMemo(() => {
    const mapped: Record<string, number[]> = {}

    Object.entries(reservationsByRideInstanceId).forEach(([rideInstanceId, reservations]) => {
      mapped[rideInstanceId] = reservations
        .filter((reservation) => reservation.status === "active")
        .map((reservation) => reservation.seatNumber)
    })

    return mapped
  }, [reservationsByRideInstanceId])

  const capacityByRideInstanceId = useMemo(() => {
    const mapped: Record<string, number> = {}

    Object.values(rideInstancesById).forEach((rideInstance) => {
      mapped[rideInstance.id] = rideInstance.ride.busCapacity
    })

    return mapped
  }, [rideInstancesById])

  const knownStationIds = useMemo(
    () => new Set(stations.map((station) => station.id)),
    [stations]
  )

  const parseFile = useCallback(
    async (file: File) => {
      if (stations.length === 0) {
        toast.error("Stanice se jos ucitavaju, pokusajte ponovo")
        return
      }

      try {
        const content = await file.text()
        const result = buildImportRows(content, { stations, aliases })

        if (result.missingColumns.length > 0) {
          setRows([])
          setParseWarnings(null)
          setParseError(
            `CSV nema obavezne kolone: ${result.missingColumns.join(", ")}. Ocekivane kolone su Ime i prezime, Polazi iz, Dolazi u, Datum odlaska.`
          )
          return
        }

        if (result.rows.length === 0) {
          setRows([])
          setParseWarnings(null)
          setParseError("CSV ne sadrzi nijedan red sa podacima.")
          return
        }

        setParseError(null)
        setCommitResult(null)
        setRows(result.rows)
        setParseWarnings({
          fileName: file.name,
          unmappedHeaders: result.unmappedHeaders,
          skippedLineNumbers: result.skippedLineNumbers,
        })
      } catch {
        setParseError("Datoteka nije mogla biti procitana.")
      }
    },
    [aliases, stations]
  )

  // Fill in ride-instance candidates once instances for the file's dates load,
  // and again whenever a row's route changes — correcting an unmatched station
  // has to re-resolve which ride serves that row.
  const routeSignature = useMemo(
    () =>
      rows
        .map((row) => `${row.id}:${row.travelDate}:${row.departureStationId ?? ""}:${row.arrivalStationId ?? ""}`)
        .join("|"),
    [rows]
  )

  useEffect(() => {
    setRows((currentRows) => {
      let changed = false

      const nextRows = currentRows.map((row) => {
        const instancesForDate = rideInstancesByDate[row.travelDate] ?? []
        const resolution = resolveRideInstance(
          instancesForDate,
          row.departureStationId,
          row.arrivalStationId
        )

        const candidatesChanged =
          resolution.candidateIds.join("|") !== row.rideInstanceCandidateIds.join("|")

        // Never overwrite an operator's explicit pick; only drop it if the
        // ride no longer serves the row's route.
        const keepsCurrentSelection =
          row.rideInstanceId !== null && resolution.candidateIds.includes(row.rideInstanceId)

        const nextRideInstanceId = keepsCurrentSelection
          ? row.rideInstanceId
          : resolution.resolvedId

        if (!candidatesChanged && nextRideInstanceId === row.rideInstanceId) {
          return row
        }

        changed = true
        return {
          ...row,
          rideInstanceCandidateIds: resolution.candidateIds,
          rideInstanceId: nextRideInstanceId,
        }
      })

      return changed ? nextRows : currentRows
    })
    // `routeSignature` stands in for the row fields the resolution reads; the
    // rows themselves are reached through the setState updater.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideInstancesByDate, routeSignature])

  // Link rows to existing passengers once the passenger directory is loaded.
  useEffect(() => {
    const passengers = passengersQuery.data
    if (!passengers || passengers.length === 0) {
      return
    }

    const index = buildPassengerIndex(passengers)

    setRows((currentRows) => {
      let changed = false

      const nextRows = currentRows.map((row) => {
        const match = findExistingPassenger(index, row.firstName, row.lastName, row.phone)
        const passengerId = match?.id ?? null

        if (passengerId === row.passengerId) {
          return row
        }

        changed = true
        return { ...row, passengerId }
      })

      return changed ? nextRows : currentRows
    })
  }, [passengersQuery.data])

  const seatedRows = useMemo(
    () => assignSeats(rows, { bookedSeatsByRideInstanceId, capacityByRideInstanceId }),
    [rows, bookedSeatsByRideInstanceId, capacityByRideInstanceId]
  )

  const validatedRows: ImportRowState[] = useMemo(
    () =>
      validateImportRows(seatedRows, {
        rideInstancesById,
        bookedSeatsByRideInstanceId,
        knownStationIds,
      }),
    [seatedRows, rideInstancesById, bookedSeatsByRideInstanceId, knownStationIds]
  )

  const summary = useMemo(() => summarizeRows(validatedRows), [validatedRows])

  const updateRow = useCallback((rowId: string, patch: Partial<ImportRow>) => {
    setRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== rowId) {
          return row
        }

        const next = { ...row, ...patch }

        // A manual seat entry stops being a suggestion; clearing it hands the
        // seat back to auto-assignment.
        if (patch.seatNumber !== undefined) {
          next.seatIsAutoAssigned = patch.seatNumber === null
        }

        if (patch.departureStationId !== undefined) {
          next.departureMatch = "manual"
        }

        if (patch.arrivalStationId !== undefined) {
          next.arrivalMatch = "manual"
        }

        return next
      })
    )
  }, [])

  const removeRow = useCallback((rowId: string) => {
    setRows((currentRows) => currentRows.filter((row) => row.id !== rowId))
  }, [])

  const toggleRowExcluded = useCallback((rowId: string) => {
    setRows((currentRows) =>
      currentRows.map((row) => (row.id === rowId ? { ...row, excluded: !row.excluded } : row))
    )
  }, [])

  /** Applies one station choice to every row sharing the same raw CSV spelling. */
  const applyStationToAllMatching = useCallback(
    (rawStation: string, stationId: string) => {
      setRows((currentRows) =>
        currentRows.map((row) => {
          const patch: Partial<ImportRow> = {}

          if (row.source.departure.trim() === rawStation.trim()) {
            patch.departureStationId = stationId
            patch.departureMatch = "manual"
          }

          if (row.source.arrival.trim() === rawStation.trim()) {
            patch.arrivalStationId = stationId
            patch.arrivalMatch = "manual"
          }

          return Object.keys(patch).length > 0 ? { ...row, ...patch } : row
        })
      )
    },
    []
  )

  const reset = useCallback(() => {
    setRows([])
    setParseWarnings(null)
    setParseError(null)
    setCommitResult(null)
  }, [])

  const { commit, isCommitting } = useImportCommit({
    rideInstancesById,
    // Passengers are created before any reservation and are not rolled back,
    // so pin them onto their rows straight away. A retry then reuses them
    // instead of creating the same people twice.
    onPassengersLinked: (passengerIdByRowId) => {
      setRows((currentRows) =>
        currentRows.map((row) => {
          const passengerId = passengerIdByRowId[row.id]
          return passengerId && passengerId !== row.passengerId
            ? { ...row, passengerId }
            : row
        })
      )
    },
    onCompleted: (result) => {
      setCommitResult(result)
      setRows((currentRows) => {
        const importedRowIds = new Set(result.importedRowIds)
        return currentRows.filter((row) => !importedRowIds.has(row.id))
      })
    },
  })

  const submit = useCallback(() => {
    if (!summary.canSubmit) {
      toast.error("Ispravite sve greske pre uvoza")
      return
    }

    commit(validatedRows.filter((row) => !row.excluded))
  }, [commit, summary.canSubmit, validatedRows])

  return {
    rows: validatedRows,
    summary,
    stations,
    rideInstancesById,
    rideInstancesByDate,
    parseWarnings,
    parseError,
    commitResult,
    isLoadingReference: stationsQuery.isLoading || ridesQuery.isLoading,
    isResolving: isLoadingRideInstances || isLoadingReservations || passengersQuery.isLoading,
    isCommitting,
    parseFile,
    updateRow,
    removeRow,
    toggleRowExcluded,
    applyStationToAllMatching,
    submit,
    reset,
  }
}
