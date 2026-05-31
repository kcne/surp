"use client"

import { useEffect, useMemo, useRef } from "react"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
} from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { FieldSection } from "@/components/reservations/primitives/FieldSection"
import { PassengerForm } from "../passengers/PassengerForm"
import { ArrowLeftRight, MapPinned, RotateCcw, UserPlus, Users, X } from "lucide-react"
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
import { useDuplicatePassengerCheck } from "@/hooks/useDuplicatePassengerCheck"
import { DuplicatePassengerDialog } from "@/components/passengers/DuplicatePassengerDialog"
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
  const passengerFormRef = useRef<HTMLDivElement>(null)
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
    mode: "onChange",
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
    addPassengerTargetSeat,
    travelTogether,
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
    setAddPassengerTargetSeat,
    setTravelTogether,
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

  const returnReservationsQuery = useReservationsByRideInstancesQuery(
    returnRideInstances,
    { enabled: open && (!!reservation || isReturnTicket) }
  )

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
    existingReturnReservation,
    isMultiReservation,
    selectedSeats,
    perSeatPassengers,
    travelTogether,
    allReservations,
    closeReservationModal,
    onComplete,
    assignmentMode,
    setSelectedPassenger,
    setNewPassenger,
    setShowPassengerForm,
    setPerSeatPassengers,
    addPassengerTargetSeat,
    setAddPassengerTargetSeat,
    selectedRideInstance,
    createReservation: async (payload) => {
      await createReservationMutation.mutateAsync(payload)
    },
    createReservationsBatch: async (payload) => {
      await createReservationsBatchMutation.mutateAsync(payload)
    },
    createReservationsForRideInstance: async (instance, requests, options) => {
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
        travelTogether: options?.travelTogether,
      })
    },
    updateReservation: async (reservationId, data) => {
      await updateReservationMutation.mutateAsync({ id: reservationId, payload: data })
    },
    clearSelectedSeats: () => undefined,
    createPassenger: createPassengerMutation.mutateAsync,
  })

  const duplicateCheck = useDuplicatePassengerCheck({
    onConfirmedCreate: handleAddNewPassenger,
  })

  const canSubmit =
    assignmentMode === "perSeat"
      ? selectedSeats.length > 0 &&
        selectedSeats.every((seat) => Boolean(perSeatPassengers[seat]))
      : form.formState.isValid

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

  useEffect(() => {
    if (!showPassengerForm) return
    const node = passengerFormRef.current
    if (!node) return
    // Defer to next frame so the section is laid out before scrolling.
    const id = window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "start" })
    })
    return () => window.cancelAnimationFrame(id)
  }, [showPassengerForm])

  if (!selectedRideInstance) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="flex h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[720px]">
        <DialogHeader className="shrink-0 border-b px-6 pb-3 pt-5">
          <DialogTitle>
            {isEdit
              ? "Izmeni rezervaciju"
              : isMultipleSeatsSelection
                ? "Kreiraj rezervacije"
                : "Kreiraj rezervaciju"}
          </DialogTitle>
          {(isEdit || !isMultipleSeatsSelection) && (
            <DialogDescription>
              {isEdit
                ? "Izmenite informacije o rezervaciji."
                : "Unesite informacije za novu rezervaciju."}
            </DialogDescription>
          )}
        </DialogHeader>

        <Form {...form}>
          <form
            id="reservation-form"
            onSubmit={(e) => {
              if (!showPassengerForm && assignmentMode === "single") {
                form.handleSubmit(onSubmit)(e)
              } else {
                e.preventDefault()
                e.stopPropagation()
              }
            }}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
          <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-4 pt-2">
            <ReservationRideInfoCard
              rideInstance={selectedRideInstance}
              seatDisplay={seatDisplay}
            />

            {showAssignmentMode && (
              <FieldSection
                icon={Users}
                title="Način raspodele sedišta"
                description="Izaberite jednog putnika za sva sedišta ili dodelite svako pojedinačno."
              >
                <ReservationAssignmentModeSection
                  assignmentMode={assignmentMode}
                  onAssignmentModeChange={setAssignmentMode}
                  showTravelTogether={selectedSeats.length > 1 && !isEdit}
                  travelTogether={travelTogether}
                  onTravelTogetherChange={setTravelTogether}
                />
              </FieldSection>
            )}

            {showPassengerForm && (
              <div ref={passengerFormRef}>
                <FieldSection
                  icon={UserPlus}
                  title="Dodaj novog putnika"
                  description="Putnik će biti automatski dodeljen ovoj rezervaciji."
                  trailing={
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowPassengerForm(false)
                        setAddPassengerTargetSeat(null)
                      }}
                      aria-label="Zatvori formu putnika"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  }
                  className="border-primary/40 bg-primary/5"
                >
                  <PassengerForm
                    onSubmit={duplicateCheck.start}
                    onCancel={() => {
                      setShowPassengerForm(false)
                      setAddPassengerTargetSeat(null)
                    }}
                  />
                </FieldSection>
              </div>
            )}

            {assignmentMode === "single" && (
              <FieldSection
                icon={UserPlus}
                title="Putnik"
                description="Pretražite postojećeg putnika ili dodajte novog."
                trailing={
                  !showPassengerForm ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPassengerForm(true)}
                    >
                      <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                      Novi putnik
                    </Button>
                  ) : undefined
                }
              >
                <ReservationPassengerSelectionSection
                  control={form.control}
                  selectedPassenger={selectedPassenger}
                  onSelectPassenger={setSelectedPassenger}
                  onAddNewPassenger={() => setShowPassengerForm(true)}
                />
              </FieldSection>
            )}

            {showAssignmentMode && assignmentMode === "perSeat" && (
              <FieldSection
                icon={Users}
                title="Putnici po sedištu"
                description="Dodelite putnika svakom izabranom sedištu."
              >
                <ReservationPerSeatPassengersSection
                  selectedSeats={selectedSeats}
                  perSeatPassengers={perSeatPassengers}
                  onSelectPassenger={(seat, passenger) => {
                    setPerSeatPassengers((prev) => ({
                      ...prev,
                      [seat]: passenger,
                    }))
                  }}
                  onAddNewPassengerForSeat={(seat) => {
                    setAddPassengerTargetSeat(seat)
                    setShowPassengerForm(true)
                  }}
                />
              </FieldSection>
            )}

            <FieldSection
              icon={MapPinned}
              title="Stanice"
              description="Polazna i dolazna stanica za ovog putnika."
            >
              <ReservationStationsSection
                control={form.control}
                allStations={allStations}
                departureStationId={departureStationId}
                arrivalStationId={arrivalStationId}
              />
            </FieldSection>

            <FieldSection
              icon={ArrowLeftRight}
              title="Povratna karta"
              description="Opcionalno: dodajte povratnu vožnju u istu rezervaciju."
              trailing={
                isReturnTicket ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    <RotateCcw className="h-3 w-3" />
                    Povratna
                  </span>
                ) : undefined
              }
            >
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
            </FieldSection>
          </div>

          <div className="border-t bg-background px-6 py-3 shrink-0">
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
              canSubmit={canSubmit}
            />
          </div>
        </form>
      </Form>
      </DialogContent>
      <DuplicatePassengerDialog
        open={duplicateCheck.isOpen}
        onOpenChange={(value) => {
          if (!value) duplicateCheck.cancel()
        }}
        matches={duplicateCheck.matches}
        loading={createPassengerMutation.isPending}
        onConfirm={duplicateCheck.confirm}
        onCancel={duplicateCheck.cancel}
      />
    </Dialog>
  )
}
