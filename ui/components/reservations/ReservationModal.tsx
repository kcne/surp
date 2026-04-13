"use client"

import { useMemo } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { reservationSchema } from "@/utils/validators"
import type { ReservationFormData, Reservation, Passenger, RideInstance } from "@/types"
import { useRidesListQuery } from "@/infrastructure/hooks/queries/useRidesListQuery"
import {
  useReservationsByRideInstancesQuery,
} from "@/infrastructure/hooks/queries/useReservationsByRideInstanceQuery"
import {
  useCancelReservationMutation,
  useCreateReservationMutation,
  useCreateReservationsBatchMutation,
  useUpdateReservationMutation,
} from "@/infrastructure/hooks/mutations/useReservationMutations"
import { useCreatePassengerMutation } from "@/infrastructure/hooks/mutations/usePassengerMutations"
import { FormModalShell } from "@/components/forms/FormModalShell"
import {
  Form,
} from "@/components/ui/form"
import { PassengerForm } from "../passengers/PassengerForm"
import { format } from "date-fns"
import { ReservationRideInfoCard } from "@/components/reservations/ReservationRideInfoCard"
import { ReservationAssignmentModeSection } from "@/components/reservations/ReservationAssignmentModeSection"
import { ReservationReturnTicketSection } from "@/components/reservations/ReservationReturnTicketSection"
import { ReservationPerSeatPassengersSection } from "@/components/reservations/ReservationPerSeatPassengersSection"
import { ReservationFormActions } from "@/components/reservations/ReservationFormActions"
import { ReservationPassengerSelectionSection } from "@/components/reservations/ReservationPassengerSelectionSection"
import { ReservationStationsSection } from "@/components/reservations/ReservationStationsSection"
import { useReservationModalState } from "@/hooks/useReservationModalState"
import { useReservationReturnSync } from "@/hooks/useReservationReturnSync"
import { useReservationSubmission } from "@/hooks/useReservationSubmission"
import { generateRideInstancesForRide } from "@/utils/rideInstanceGenerators"

const EMPTY_RIDES: Reservation["rideInstance"]["ride"][] = []

interface ReservationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedRideInstance: RideInstance | null
  reservations: Reservation[]
  seatNumber: number | null
  reservation?: Reservation | null
  selectedSeats?: number[]
  multipleSelectionMode?: boolean
  onComplete?: () => void
}


export function ReservationModal({
  open,
  onOpenChange,
  selectedRideInstance,
  reservations,
  seatNumber,
  reservation,
  selectedSeats = [],
  multipleSelectionMode = false,
  onComplete,
}: ReservationModalProps) {
  const createReservationMutation = useCreateReservationMutation()
  const createReservationsBatchMutation = useCreateReservationsBatchMutation()
  const updateReservationMutation = useUpdateReservationMutation()
  const cancelReservationMutation = useCancelReservationMutation()
  const createPassengerMutation = useCreatePassengerMutation()
  const ridesQuery = useRidesListQuery()
  const rides = ridesQuery.data ?? EMPTY_RIDES

  const isEdit = !!reservation
  const isMultiReservation = multipleSelectionMode && selectedSeats.length > 0
  const showAssignmentMode = isMultiReservation && selectedSeats.length > 1
  const isMultipleSeatsSelection = isMultiReservation && selectedSeats.length > 1
  const fallbackSeatNumber = selectedSeats[0] || seatNumber || 1
  const defaultDepartureStationId = selectedRideInstance?.ride.line.departureStation.id || ""
  const defaultArrivalStationId = selectedRideInstance?.ride.line.arrivalStation.id || ""

  const form = useForm<ReservationFormData>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      rideInstanceId: selectedRideInstance?.id || "",
      passengerId: "",
      seatNumber: fallbackSeatNumber,
      departureStationId: defaultDepartureStationId,
      arrivalStationId: defaultArrivalStationId,
    },
  })
  const departureStationId = useWatch({
    control: form.control,
    name: "departureStationId",
  })
  const arrivalStationId = useWatch({
    control: form.control,
    name: "arrivalStationId",
  })
  const {
    selectedPassenger,
    showPassengerForm,
    assignmentMode,
    perSeatPassengers,
    isReturnTicket,
    returnDatePickerOpen,
    selectedReturnDate,
    selectedReturnRideInstanceId,
    existingReturnReservation,
    setSelectedPassenger,
    setShowPassengerForm,
    setNewPassenger,
    setAssignmentMode,
    setPerSeatPassengers,
    setIsReturnTicket,
    setReturnDatePickerOpen,
    setSelectedReturnDate,
    setSelectedReturnRideInstanceId,
    setExistingReturnReservation,
    closeReservationModal,
    handleDialogOpenChange,
  } = useReservationModalState({
    open,
    onOpenChange,
    seatNumber,
    reservation,
    selectedSeats,
    showAssignmentMode,
    selectedRideInstance,
    form,
  })

  const returnRideInstances = useMemo(() => {
    if (!selectedRideInstance) {
      return []
    }

    const currentLine = selectedRideInstance.ride.line

    return rides
      .filter(
        (ride) => {
          if (ride.status === "cancelled") {
            return false
          }

          if (ride.line.id === currentLine.id) {
            return false
          }

          if (currentLine.pairKey && ride.line.pairKey) {
            return ride.line.pairKey === currentLine.pairKey
          }

          const isReverseDirection =
            ride.line.departureStation.id === currentLine.arrivalStation.id &&
            ride.line.arrivalStation.id === currentLine.departureStation.id

          return isReverseDirection
        }
      )
      .flatMap((ride) => generateRideInstancesForRide(ride))
      .filter((instance) => instance.date >= selectedRideInstance.date)
      .sort((left, right) => {
        const leftDateTime = `${left.date}T${left.departureTime}`
        const rightDateTime = `${right.date}T${right.departureTime}`
        return leftDateTime.localeCompare(rightDateTime)
      })
  }, [rides, selectedRideInstance])

  const availableReturnDateKeys = useMemo(
    () => new Set(returnRideInstances.map((instance) => instance.date)),
    [returnRideInstances]
  )

  const selectedReturnDateKey = selectedReturnDate
    ? format(selectedReturnDate, "yyyy-MM-dd")
    : ""

  const returnInstancesForSelectedDate = useMemo(
    () =>
      returnRideInstances.filter((instance) =>
        selectedReturnDateKey ? instance.date === selectedReturnDateKey : true
      ),
    [returnRideInstances, selectedReturnDateKey]
  )

  const selectedReturnRideInstance = returnRideInstances.find(
    (instance) => instance.id === selectedReturnRideInstanceId
  ) ?? null

  const returnReservationsQuery = useReservationsByRideInstancesQuery(returnRideInstances)

  const allReservations = useMemo(
    () => ({
      ...returnReservationsQuery.reservationsByRideInstanceId,
      ...(selectedRideInstance ? { [selectedRideInstance.id]: reservations } : {}),
    }),
    [reservations, returnReservationsQuery.reservationsByRideInstanceId, selectedRideInstance]
  )

  const outboundSeatNumbers = useMemo(() => {
    if (isMultiReservation) {
      return selectedSeats.slice().sort((left, right) => left - right)
    }

    if (reservation?.seatNumber) {
      return [reservation.seatNumber]
    }

    if (seatNumber) {
      return [seatNumber]
    }

    const formSeat = form.getValues("seatNumber")
    return formSeat ? [formSeat] : []
  }, [form, isMultiReservation, reservation?.seatNumber, seatNumber, selectedSeats])

  const returnSeatPreviewNumbers = useMemo(() => {
    if (
      existingReturnReservation &&
      selectedReturnRideInstanceId &&
      existingReturnReservation.rideInstanceId === selectedReturnRideInstanceId
    ) {
      return [existingReturnReservation.seatNumber]
    }

    return outboundSeatNumbers
  }, [existingReturnReservation, outboundSeatNumbers, selectedReturnRideInstanceId])

  const { onSubmit, handlePerSeatSubmit, handleAddNewPassenger } = useReservationSubmission({
    form,
    isEdit,
    reservation,
    isReturnTicket,
    selectedReturnRideInstance: selectedReturnRideInstance ?? undefined,
    isMultiReservation,
    selectedSeats,
    perSeatPassengers,
    allReservations,
    closeReservationModal,
    onComplete,
    assignmentMode,
    setSelectedPassenger,
    setNewPassenger,
    setShowPassengerForm,
    selectedRideInstance,
    createReservation: async (payload) => {
      await createReservationMutation.mutateAsync(payload)
    },
    createReservationsBatch: async (payload) => {
      await createReservationsBatchMutation.mutateAsync(payload)
    },
    createReservationsForRideInstance: async (instance, requests, _options) => {
      if (requests.length === 1) {
        await createReservationMutation.mutateAsync({
          data: requests[0],
          rideInstance: instance,
        })
        return
      }

      await createReservationsBatchMutation.mutateAsync({
        data: requests,
        rideInstance: instance,
      })
    },
    updateReservation: async (reservationId, data) => {
      await updateReservationMutation.mutateAsync({ id: reservationId, payload: data })
    },
    clearSelectedSeats: () => undefined,
    createPassenger: createPassengerMutation.mutateAsync,
  })

  const allStations = selectedRideInstance
    ? [
        {
          id: selectedRideInstance.ride.line.departureStation.id,
          name: selectedRideInstance.ride.line.departureStation.name,
        },
        ...selectedRideInstance.ride.line.intermediateStations.map((stop) => ({
          id: stop.stationId,
          name: stop.stationName,
        })),
        {
          id: selectedRideInstance.ride.line.arrivalStation.id,
          name: selectedRideInstance.ride.line.arrivalStation.name,
        },
      ]
    : []

  const selectedDepartureStationName =
    allStations.find((station) => station.id === departureStationId)?.name ||
    (selectedRideInstance ? selectedRideInstance.ride.line.departureStation.name : "")

  const selectedArrivalStationName =
    allStations.find((station) => station.id === arrivalStationId)?.name ||
    (selectedRideInstance ? selectedRideInstance.ride.line.arrivalStation.name : "")
  const seatDisplay = isMultiReservation
    ? selectedSeats.slice().sort((a, b) => a - b).join(", ")
    : String(seatNumber || reservation?.seatNumber || "")

  useReservationReturnSync({
    open,
    reservation,
    returnRideInstances,
    allReservations,
    existingReturnReservation,
    isReturnTicket,
    selectedReturnDate,
    selectedReturnDateKey,
    selectedReturnRideInstanceId,
    returnInstancesForSelectedDate,
    setExistingReturnReservation,
    setIsReturnTicket,
    setSelectedReturnRideInstanceId,
    setSelectedReturnDate,
  })

  if (!selectedRideInstance) {
    return null
  }

  return (
    <FormModalShell
      open={open}
      onOpenChange={handleDialogOpenChange}
      title={isEdit
        ? "Izmeni Rezervaciju"
        : isMultipleSeatsSelection
        ? "Kreiraj rezervacije"
        : "Kreiraj rezervaciju"}
      description={
        isEdit || !isMultipleSeatsSelection
          ? isEdit
            ? "Izmenite informacije o rezervaciji."
            : "Unesite informacije za novu rezervaciju."
          : undefined
      }
      contentClassName="sm:max-w-[700px] max-h-[90vh] overflow-y-auto"
    >

        <ReservationRideInfoCard
          rideInstance={selectedRideInstance}
          seatDisplay={seatDisplay}
        />

        {showAssignmentMode && (
          <ReservationAssignmentModeSection
            assignmentMode={assignmentMode}
            onAssignmentModeChange={setAssignmentMode}
          />
        )}

        <Form {...form}>
          <form
            onSubmit={(e) => {
              if (!showPassengerForm && assignmentMode === "single") {
                form.handleSubmit(onSubmit)(e)
              } else {
                e.preventDefault()
                e.stopPropagation()
              }
            }}
            className="space-y-4"
          >
            {/* Passenger Search */}
            {assignmentMode === "single" && (
              <ReservationPassengerSelectionSection
                control={form.control}
                selectedPassenger={selectedPassenger}
                onSelectPassenger={setSelectedPassenger}
                onAddNewPassenger={() => setShowPassengerForm(true)}
              />
            )}

            {showAssignmentMode && assignmentMode === "perSeat" && (
              <ReservationPerSeatPassengersSection
                selectedSeats={selectedSeats}
                perSeatPassengers={perSeatPassengers}
                onSelectPassenger={(seat, passenger) => {
                  setPerSeatPassengers((prev) => ({
                    ...prev,
                    [seat]: passenger,
                  }))
                }}
                onAddNewPassenger={() => setShowPassengerForm(true)}
              />
            )}

            <ReservationStationsSection
              control={form.control}
              allStations={allStations}
              departureStationId={departureStationId}
              arrivalStationId={arrivalStationId}
            />

            <ReservationReturnTicketSection
              isReturnTicket={isReturnTicket}
              onReturnTicketChange={setIsReturnTicket}
              returnRideInstancesCount={returnRideInstances.length}
              returnDatePickerOpen={returnDatePickerOpen}
              onReturnDatePickerOpenChange={setReturnDatePickerOpen}
              selectedReturnDate={selectedReturnDate}
              onSelectReturnDate={(date) => {
                setSelectedReturnDate(date)
                setReturnDatePickerOpen(false)
              }}
              availableReturnDateKeys={availableReturnDateKeys}
              selectedReturnRideInstanceId={selectedReturnRideInstanceId}
              onSelectReturnRideInstance={setSelectedReturnRideInstanceId}
              returnInstancesForSelectedDate={returnInstancesForSelectedDate}
              selectedReturnRideInstance={selectedReturnRideInstance}
              selectedArrivalStationName={selectedArrivalStationName}
              selectedDepartureStationName={selectedDepartureStationName}
              returnSeatPreviewNumbers={returnSeatPreviewNumbers}
              hasExistingReturnReservation={
                Boolean(existingReturnReservation) &&
                existingReturnReservation?.rideInstanceId === selectedReturnRideInstanceId
              }
            />

            <ReservationFormActions
              isEdit={isEdit}
              showCancelReservation={Boolean(isEdit && reservation)}
              onCancelReservation={async () => {
                if (!reservation) {
                  return
                }

                try {
                  await cancelReservationMutation.mutateAsync({
                    id: reservation.id,
                    rideInstanceId: reservation.rideInstanceId,
                  })
                  onComplete?.()
                  closeReservationModal()
                } catch (error) {
                  // Error is handled in mutation hook
                }
              }}
              onClose={closeReservationModal}
              loading={
                createReservationMutation.isPending ||
                createReservationsBatchMutation.isPending ||
                updateReservationMutation.isPending ||
                cancelReservationMutation.isPending ||
                createPassengerMutation.isPending
              }
              useSubmitAction={assignmentMode === "single" || !showAssignmentMode}
              isMultipleSeatsSelection={isMultipleSeatsSelection}
              onPerSeatSubmit={handlePerSeatSubmit}
            />
          </form>
        </Form>

        <FormModalShell
          open={showPassengerForm}
          onOpenChange={setShowPassengerForm}
          title="Dodaj Novog Putnika"
          description="Unesite informacije o putniku."
          contentClassName="sm:max-w-[560px]"
        >
            <PassengerForm
              onSubmit={handleAddNewPassenger}
              onCancel={() => {
                setShowPassengerForm(false)
              }}
            />
        </FormModalShell>
    </FormModalShell>
  )
}
