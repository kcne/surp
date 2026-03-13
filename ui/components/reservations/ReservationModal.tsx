"use client"

import { useState, useEffect, useMemo } from "react"
import { format } from "date-fns"
import { srLatn } from "date-fns/locale"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { reservationSchema } from "@/utils/validators"
import type { ReservationFormData, Reservation, Passenger, RideInstance } from "@/types"
import { useReservationsStore } from "@/stores/reservationsStore"
import { usePassengersStore } from "@/stores/passengersStore"
import { useRidesStore } from "@/stores/ridesStore"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { PassengerSearch } from "./PassengerSearch"
import { PassengerForm } from "../passengers/PassengerForm"
import { formatDateDisplay, formatTimeDisplay } from "@/utils/dateHelpers"
import { checkSeatConflict } from "@/utils/seatHelpers"
import { AlertTriangle, Armchair, Ban, Bus, Calendar as CalendarIcon, CalendarDays, Check, Clock, Save, UserPlus, X } from "lucide-react"
import { toast } from "sonner"

interface ReservationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  seatNumber: number | null
  reservation?: Reservation | null
  selectedSeats?: number[]
  multipleSelectionMode?: boolean
  onComplete?: () => void
}


export function ReservationModal({
  open,
  onOpenChange,
  seatNumber,
  reservation,
  selectedSeats = [],
  multipleSelectionMode = false,
  onComplete,
}: ReservationModalProps) {
  const {
    createReservation,
    createReservationsBatch,
    createReservationsForRideInstance,
    updateReservation,
    cancelReservation,
    selectedRideInstance,
    allReservations,
    loading,
    clearSelectedSeats,
  } = useReservationsStore()
  const { rides, generateRideInstances } = useRidesStore()
  const { createPassenger } = usePassengersStore()
  const [selectedPassenger, setSelectedPassenger] = useState<Passenger | null>(null)
  const [showPassengerForm, setShowPassengerForm] = useState(false)
  const [newPassenger, setNewPassenger] = useState<Passenger | null>(null)
  const [assignmentMode, setAssignmentMode] = useState<"single" | "perSeat">("single")
  const [perSeatPassengers, setPerSeatPassengers] = useState<Record<number, Passenger | null>>({})
  const [isReturnTicket, setIsReturnTicket] = useState(false)
  const [returnDatePickerOpen, setReturnDatePickerOpen] = useState(false)
  const [selectedReturnDate, setSelectedReturnDate] = useState<Date | undefined>(undefined)
  const [selectedReturnRideInstanceId, setSelectedReturnRideInstanceId] = useState("")
  const [existingReturnReservation, setExistingReturnReservation] = useState<Reservation | null>(null)
  const fallbackSeatNumber = selectedSeats[0] || seatNumber || 1
  const defaultDepartureStationId = selectedRideInstance?.ride.line.departureStation.id || ""
  const defaultArrivalStationId = selectedRideInstance?.ride.line.arrivalStation.id || ""

  const isEdit = !!reservation
  const isMultiReservation = multipleSelectionMode && selectedSeats.length > 0
  const showAssignmentMode = isMultiReservation && selectedSeats.length > 1
  const isMultipleSeatsSelection = isMultiReservation && selectedSeats.length > 1

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

  // Track if modal was just opened to prevent resetting when passenger is created
  const [wasJustOpened, setWasJustOpened] = useState(false)

  useEffect(() => {
    if (open && !wasJustOpened) {
      // Modal was just opened - initialize form
      setWasJustOpened(true)
      if (selectedRideInstance) {
        form.setValue("rideInstanceId", selectedRideInstance.id)
      }
      if (seatNumber) {
        form.setValue("seatNumber", seatNumber)
      }
      if (reservation) {
        form.reset({
          rideInstanceId: reservation.rideInstanceId,
          passengerId: reservation.passengerId,
          seatNumber: reservation.seatNumber,
          departureStationId: reservation.departureStationId,
          arrivalStationId: reservation.arrivalStationId,
          status: reservation.status,
        })
        setSelectedPassenger(reservation.passenger)
        setShowPassengerForm(false)
        setIsReturnTicket(false)
        setSelectedReturnDate(undefined)
        setSelectedReturnRideInstanceId("")
        setExistingReturnReservation(null)
      } else {
        form.reset({
          rideInstanceId: selectedRideInstance?.id || "",
          passengerId: "",
          seatNumber: fallbackSeatNumber,
          departureStationId: defaultDepartureStationId,
          arrivalStationId: defaultArrivalStationId,
        })
        setSelectedPassenger(null)
        setNewPassenger(null)
        setShowPassengerForm(false)
        setAssignmentMode("single")
        setPerSeatPassengers({})
        setIsReturnTicket(false)
        setSelectedReturnDate(undefined)
        setSelectedReturnRideInstanceId("")
        setExistingReturnReservation(null)
      }
    } else if (!open) {
      // Modal was closed - reset the flag
      setWasJustOpened(false)
    }
  }, [
    open,
    selectedRideInstance,
    seatNumber,
    reservation,
    form,
    wasJustOpened,
    selectedSeats,
    fallbackSeatNumber,
    defaultDepartureStationId,
    defaultArrivalStationId,
  ])

  useEffect(() => {
    if (selectedPassenger) {
      form.setValue("passengerId", selectedPassenger.id)
    }
  }, [selectedPassenger, form])

  useEffect(() => {
    if (newPassenger) {
      // This is already handled in handleAddNewPassenger
      // But keep this as a backup in case newPassenger is set from elsewhere
      if (assignmentMode === "single") {
        setSelectedPassenger(newPassenger)
        setShowPassengerForm(false)
        form.setValue("passengerId", newPassenger.id)
      }
    }
  }, [newPassenger, form, assignmentMode])

  useEffect(() => {
    if (!showAssignmentMode && assignmentMode !== "single") {
      setAssignmentMode("single")
    }
  }, [showAssignmentMode, assignmentMode])

  const onSubmit = async (data: ReservationFormData) => {
    try {
      if (isEdit && reservation) {
        await updateReservation(reservation.id, data)
        if (isReturnTicket) {
          if (!selectedReturnRideInstance) {
            throw new Error("Izaberite datum i vreme povratne vožnje.")
          }

          const returnRequests = buildReturnRequests([data], selectedReturnRideInstance)
          await createReservationsForRideInstance(selectedReturnRideInstance, returnRequests, {
            showSuccessToast: false,
          })
          toast.success("Povratna karta je uspešno rezervisana")
        }
      } else if (isMultiReservation) {
        const requests = selectedSeats.map((seat) => ({
          ...data,
          seatNumber: seat,
        }))
        await createWithOptionalReturn(requests)
        clearSelectedSeats()
        onComplete?.()
        return
      } else {
        await createWithOptionalReturn([data])
      }
      onOpenChange(false)
      form.reset()
      setSelectedPassenger(null)
      setNewPassenger(null)
      setShowPassengerForm(false)
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message)
      }
    }
  }

  const handlePerSeatSubmit = async () => {
    try {
      const isStationsValid = await form.trigger([
        "departureStationId",
        "arrivalStationId",
      ])

      if (!isStationsValid) {
        return
      }

      const sharedValues = form.getValues()

      const perSeatRequests = selectedSeats.map((seat) => {
        const passenger = perSeatPassengers[seat]
        if (!passenger) {
          throw new Error(`Putnik nije izabran za sedište ${seat}`)
        }
        return {
          ...sharedValues,
          seatNumber: seat,
          passengerId: passenger.id,
        }
      })

      await createWithOptionalReturn(perSeatRequests)
      clearSelectedSeats()
      onComplete?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greška pri kreiranju rezervacija")
    }
  }

  const handleAddNewPassenger = async (passengerData: any) => {
    try {
      // Step 1: Create passenger in store (this persists to localStorage)
      const passenger = await createPassenger(passengerData)
      
      // Step 2: Select and display the newly created passenger
      if (assignmentMode === "single") {
        setSelectedPassenger(passenger)
        form.setValue("passengerId", passenger.id)
        setNewPassenger(passenger)
      }
      
      // Hide the passenger form and show passenger search with selected passenger
      setShowPassengerForm(false)
      
      // Modal stays open - user can now enter remaining data (stations)
      // Step 3: User enters remaining data (departure/arrival stations)
      // Step 4: User clicks "Kreiraj Rezervaciju" to create reservation
      
      // Passenger is now saved in store and will be available in search next time
    } catch (error) {
      // Error is handled in store
      // Don't close the form on error so user can retry
      throw error // Re-throw to prevent form reset
    }
  }

  const getOrderedStations = (instance: RideInstance) => {
    const orderedIntermediate = [...instance.ride.line.intermediateStations].sort(
      (left, right) => left.order - right.order
    )

    return [
      { stationId: instance.ride.line.departureStation.id, order: 0 },
      ...orderedIntermediate.map((station, index) => ({
        stationId: station.stationId,
        order: index + 1,
      })),
      {
        stationId: instance.ride.line.arrivalStation.id,
        order: orderedIntermediate.length + 1,
      },
    ]
  }

  const returnRideInstances = useMemo(() => {
    if (!selectedRideInstance) {
      return []
    }

    const currentLine = selectedRideInstance.ride.line
    if (!currentLine.pairKey) {
      return []
    }

    return rides
      .filter(
        (ride) =>
          ride.status !== "cancelled" &&
          ride.line.pairKey === currentLine.pairKey &&
          ride.line.id !== currentLine.id &&
          ride.line.departureStation.id === currentLine.arrivalStation.id &&
          ride.line.arrivalStation.id === currentLine.departureStation.id
      )
      .flatMap((ride) => generateRideInstances(ride))
      .filter((instance) => instance.date >= selectedRideInstance.date)
      .sort((left, right) => {
        const leftDateTime = `${left.date}T${left.departureTime}`
        const rightDateTime = `${right.date}T${right.departureTime}`
        return leftDateTime.localeCompare(rightDateTime)
      })
  }, [generateRideInstances, rides, selectedRideInstance])

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

  const buildReturnRequests = (
    outboundRequests: ReservationFormData[],
    returnInstance: RideInstance
  ) => {
    const returnDepartureStationId = form.getValues("arrivalStationId")
    const returnArrivalStationId = form.getValues("departureStationId")
    const returnStations = getOrderedStations(returnInstance)

    const returnDepOrder = returnStations.find((s) => s.stationId === returnDepartureStationId)?.order
    const returnArrOrder = returnStations.find((s) => s.stationId === returnArrivalStationId)?.order

    if (returnDepOrder == null || returnArrOrder == null || returnArrOrder <= returnDepOrder) {
      throw new Error("Povratna vožnja ne podržava izabrane stanice.")
    }

    const existingReturnReservations = (allReservations[returnInstance.id] || []).filter(
      (reservation) => reservation.status === "active"
    )
    const workingReservations = [...existingReturnReservations]

    return outboundRequests.map((outboundRequest) => {
      const preferredSeat = outboundRequest.seatNumber
      const hasPreferredSeatConflict = checkSeatConflict(
        workingReservations,
        preferredSeat,
        returnDepartureStationId,
        returnArrivalStationId,
        returnStations
      )

      let assignedSeat = preferredSeat
      if (hasPreferredSeatConflict) {
        const firstAvailableSeat = Array.from(
          { length: returnInstance.ride.busCapacity },
          (_, index) => index + 1
        ).find(
          (seatNumber) =>
            !checkSeatConflict(
              workingReservations,
              seatNumber,
              returnDepartureStationId,
              returnArrivalStationId,
              returnStations
            )
        )

        if (!firstAvailableSeat) {
          throw new Error("Nema slobodnih sedišta za povratnu vožnju.")
        }

        assignedSeat = firstAvailableSeat
      }

      workingReservations.push({
        id: `planned-${outboundRequest.passengerId}-${assignedSeat}`,
        rideInstanceId: returnInstance.id,
        rideInstance: returnInstance,
        passengerId: outboundRequest.passengerId,
        passenger: {
          id: "",
          firstName: "",
          lastName: "",
          phone: "",
          passengerType: "odrasli",
        },
        seatNumber: assignedSeat,
        departureStationId: returnDepartureStationId,
        departureStation: { id: "", name: "", address: "" },
        arrivalStationId: returnArrivalStationId,
        arrivalStation: { id: "", name: "", address: "" },
        status: "active",
      })

      return {
        ...outboundRequest,
        rideInstanceId: returnInstance.id,
        departureStationId: returnDepartureStationId,
        arrivalStationId: returnArrivalStationId,
        seatNumber: assignedSeat,
      }
    })
  }

  const createWithOptionalReturn = async (outboundRequests: ReservationFormData[]) => {
    let returnRequests: ReservationFormData[] = []

    if (isReturnTicket) {
      if (!selectedReturnRideInstance) {
        throw new Error("Izaberite datum i vreme povratne vožnje.")
      }

      returnRequests = buildReturnRequests(outboundRequests, selectedReturnRideInstance)
    }

    if (outboundRequests.length === 1 && !isMultiReservation) {
      await createReservation(outboundRequests[0])
    } else {
      await createReservationsBatch(outboundRequests)
    }

    if (returnRequests.length > 0 && selectedReturnRideInstance) {
      await createReservationsForRideInstance(selectedReturnRideInstance, returnRequests, {
        showSuccessToast: false,
      })
      toast.success("Povratna karta je uspešno rezervisana")
    }
  }

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
    allStations.find((station) => station.id === form.watch("departureStationId"))?.name ||
    (selectedRideInstance ? selectedRideInstance.ride.line.departureStation.name : "")

  const selectedArrivalStationName =
    allStations.find((station) => station.id === form.watch("arrivalStationId"))?.name ||
    (selectedRideInstance ? selectedRideInstance.ride.line.arrivalStation.name : "")

  const handleDialogOpenChange = (isOpen: boolean) => {
    // Only allow closing if passenger form is not open
    // This prevents accidental closing while adding passenger
    if (!isOpen && showPassengerForm) {
      // Don't close if passenger form is open - let user cancel first
      return
    }
    // Reset form state when closing
    if (!isOpen) {
      form.reset()
      setSelectedPassenger(null)
      setNewPassenger(null)
      setShowPassengerForm(false)
      setWasJustOpened(false) // Reset the flag when modal closes
      setAssignmentMode("single")
      setPerSeatPassengers({})
      setIsReturnTicket(false)
      setSelectedReturnDate(undefined)
      setSelectedReturnRideInstanceId("")
      setExistingReturnReservation(null)
    }
    onOpenChange(isOpen)
  }

  useEffect(() => {
    if (!open || !reservation || returnRideInstances.length === 0) {
      return
    }

    const returnInstanceById = new Map(
      returnRideInstances.map((instance) => [instance.id, instance])
    )

    const candidates = Object.entries(allReservations)
      .flatMap(([instanceId, reservationsForInstance]) => {
        if (!returnInstanceById.has(instanceId)) {
          return []
        }
        return reservationsForInstance
      })
      .filter((candidate) => {
        if (candidate.status !== "active") return false
        if (candidate.passengerId !== reservation.passengerId) return false
        if (candidate.departureStationId !== reservation.arrivalStationId) return false
        if (candidate.arrivalStationId !== reservation.departureStationId) return false
        return true
      })
      .sort((left, right) => {
        const leftSeatScore = left.seatNumber === reservation.seatNumber ? 0 : 1
        const rightSeatScore = right.seatNumber === reservation.seatNumber ? 0 : 1
        if (leftSeatScore !== rightSeatScore) {
          return leftSeatScore - rightSeatScore
        }

        const leftInstance = returnInstanceById.get(left.rideInstanceId)
        const rightInstance = returnInstanceById.get(right.rideInstanceId)

        const leftDateTime = leftInstance
          ? `${leftInstance.date}T${leftInstance.departureTime}`
          : ""
        const rightDateTime = rightInstance
          ? `${rightInstance.date}T${rightInstance.departureTime}`
          : ""

        return leftDateTime.localeCompare(rightDateTime)
      })

    const matched = candidates[0]

    if (!matched) {
      setExistingReturnReservation(null)
      return
    }

    const matchedInstance = returnInstanceById.get(matched.rideInstanceId)
    if (!matchedInstance) {
      setExistingReturnReservation(null)
      return
    }

    setExistingReturnReservation(matched)
    setIsReturnTicket(true)
    setSelectedReturnRideInstanceId(matchedInstance.id)
    setSelectedReturnDate(new Date(`${matchedInstance.date}T00:00:00`))
  }, [open, reservation, returnRideInstances, allReservations])

  useEffect(() => {
    if (!isReturnTicket) {
      setSelectedReturnDate(undefined)
      setSelectedReturnRideInstanceId("")
      return
    }

    if (!selectedReturnDate && returnRideInstances.length > 0) {
      const first = returnRideInstances[0]
      setSelectedReturnDate(new Date(`${first.date}T00:00:00`))
      setSelectedReturnRideInstanceId(first.id)
    }
  }, [isReturnTicket, returnRideInstances, selectedReturnDate])

  useEffect(() => {
    if (!isReturnTicket || !selectedReturnDateKey) return

    const selectedStillExists = returnInstancesForSelectedDate.some(
      (instance) => instance.id === selectedReturnRideInstanceId
    )

    if (!selectedStillExists) {
      setSelectedReturnRideInstanceId(returnInstancesForSelectedDate[0]?.id || "")
    }
  }, [
    isReturnTicket,
    selectedReturnDateKey,
    selectedReturnRideInstanceId,
    returnInstancesForSelectedDate,
  ])

  if (!selectedRideInstance) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? "Izmeni Rezervaciju"
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

        {/* Ride Info */}
        <div className="rounded-lg border bg-gray-50 p-4 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Bus className="h-4 w-4 text-muted-foreground" />
            <p>
              <span className="font-semibold">Vožnja:</span>{" "}
              {selectedRideInstance.ride.line.name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <p>
              <span className="font-semibold">Datum:</span>{" "}
              {formatDateDisplay(new Date(selectedRideInstance.date))}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <p>
              <span className="font-semibold">Vreme:</span>{" "}
              {formatTimeDisplay(selectedRideInstance.departureTime)} -{" "}
              {formatTimeDisplay(selectedRideInstance.arrivalTime)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Armchair className="h-4 w-4 text-muted-foreground" />
            <p>
              <span className="font-semibold">Sedište:</span>{" "}
              {isMultiReservation
                ? selectedSeats.slice().sort((a, b) => a - b).join(", ")
                : seatNumber || reservation?.seatNumber}
            </p>
          </div>
        </div>

        {showAssignmentMode && (
          <div className="rounded-lg border bg-white p-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Način raspodele sedišta</p>
              <Select
                onValueChange={(value) =>
                  setAssignmentMode(value === "perSeat" ? "perSeat" : "single")
                }
                value={assignmentMode}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Izaberite režim" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Jedan Putnik</SelectItem>
                  <SelectItem value="perSeat">Više putnika</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-orange-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {assignmentMode === "single"
                  ? "Sva izabrana sedišta biće dodeljena jednom putniku."
                  : "Izaberite putnika za svako sedište posebno."}
              </p>
            </div>
          </div>
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
              <FormField
                control={form.control}
                name="passengerId"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Putnik *</FormLabel>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPassengerForm(true)}
                        className="text-primary"
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Dodaj Novog Putnika
                      </Button>
                    </div>
                    <FormControl>
                      <PassengerSearch
                        value={selectedPassenger}
                        onSelect={(passenger) => {
                          setSelectedPassenger(passenger)
                          field.onChange(passenger?.id || "")
                        }}
                        onAddNew={() => setShowPassengerForm(true)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {showAssignmentMode && assignmentMode === "perSeat" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Putnici po sedištu *</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPassengerForm(true)}
                    className="text-primary"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Dodaj Novog Putnika
                  </Button>
                </div>
                <div className="grid gap-3">
                  {selectedSeats
                    .slice()
                    .sort((a, b) => a - b)
                    .map((seat) => (
                      <div key={seat} className="rounded-lg border p-3 bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold">Sedište {seat}</span>
                        </div>
                        <PassengerSearch
                          value={perSeatPassengers[seat] || null}
                          onSelect={(passenger) => {
                            setPerSeatPassengers((prev) => ({
                              ...prev,
                              [seat]: passenger,
                            }))
                          }}
                          onAddNew={() => setShowPassengerForm(true)}
                        />
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Stations */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="departureStationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Polazna Stanica *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Izaberite polaznu stanicu" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {allStations
                          .filter((s) => s.id !== form.watch("arrivalStationId"))
                          .map((station) => (
                            <SelectItem key={station.id} value={station.id}>
                              {station.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="arrivalStationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dolazna Stanica *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Izaberite dolaznu stanicu" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {allStations
                          .filter((s) => s.id !== form.watch("departureStationId"))
                          .map((station) => {
                            const depStationId = form.watch("departureStationId")
                            const depStation = allStations.find(
                              (s) => s.id === depStationId
                            )
                            const depIndex = depStation
                              ? allStations.findIndex((s) => s.id === depStation.id)
                              : -1
                            const currentIndex = allStations.findIndex(
                              (s) => s.id === station.id
                            )

                            return (
                              <SelectItem
                                key={station.id}
                                value={station.id}
                                disabled={
                                  depIndex >= 0 && currentIndex <= depIndex
                                }
                              >
                                {station.name}
                              </SelectItem>
                            )
                          })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="return-ticket"
                    checked={isReturnTicket}
                    onCheckedChange={(checked) => setIsReturnTicket(checked === true)}
                    disabled={returnRideInstances.length === 0}
                  />
                  <label htmlFor="return-ticket" className="text-sm font-medium leading-none">
                    Povratna karta
                  </label>
                </div>

                {returnRideInstances.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nema dostupnih vožnji u suprotnom smeru za povratnu kartu.
                  </p>
                ) : null}

                {isReturnTicket && returnRideInstances.length > 0 && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Popover open={returnDatePickerOpen} onOpenChange={setReturnDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                          >
                            <CalendarDays className="mr-2 h-4 w-4" />
                            {selectedReturnDate
                              ? format(selectedReturnDate, "d. MMMM yyyy", { locale: srLatn })
                              : "Datum povratka"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2" align="start">
                          <Calendar
                            mode="single"
                            selected={selectedReturnDate}
                            onSelect={(date) => {
                              setSelectedReturnDate(date)
                              setReturnDatePickerOpen(false)
                            }}
                            locale={srLatn}
                            disabled={(date) => {
                              const dateKey = format(date, "yyyy-MM-dd")
                              return !availableReturnDateKeys.has(dateKey)
                            }}
                            className="rounded-md border"
                          />
                        </PopoverContent>
                      </Popover>

                      <Select
                        value={selectedReturnRideInstanceId}
                        onValueChange={setSelectedReturnRideInstanceId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Vreme povratka" />
                        </SelectTrigger>
                        <SelectContent>
                          {returnInstancesForSelectedDate.map((instance) => (
                            <SelectItem key={instance.id} value={instance.id}>
                              {formatTimeDisplay(instance.departureTime)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedReturnRideInstance ? (
                      <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                        <p>
                          <span className="font-semibold text-foreground">Preselektovano:</span>{" "}
                          {formatDateDisplay(new Date(selectedReturnRideInstance.date))} •{" "}
                          {formatTimeDisplay(selectedReturnRideInstance.departureTime)} - {formatTimeDisplay(selectedReturnRideInstance.arrivalTime)}
                        </p>
                        <p>
                          <span className="font-semibold text-foreground">Ruta:</span>{" "}
                          {selectedArrivalStationName} → {selectedDepartureStationName}
                        </p>
                        <p>
                          <span className="font-semibold text-foreground">Sedišta:</span>{" "}
                          {returnSeatPreviewNumbers.length > 0
                            ? returnSeatPreviewNumbers.join(", ")
                            : "Biće dodeljena pri potvrdi"}
                          {" "}(isti broj ako je slobodan, inače prvo slobodno)
                        </p>
                        {existingReturnReservation &&
                        existingReturnReservation.rideInstanceId === selectedReturnRideInstanceId ? (
                          <p>
                            <span className="font-semibold text-foreground">Status:</span> Učitani postojeći podaci povratne karte
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

            <DialogFooter className="flex items-center justify-between">
              <div>
                {isEdit && reservation && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={async () => {
                      try {
                        await cancelReservation(reservation.id)
                        onOpenChange(false)
                        form.reset()
                        setSelectedPassenger(null)
                        setNewPassenger(null)
                        setShowPassengerForm(false)
                      } catch (error) {
                        // Error is handled in store
                      }
                    }}
                    disabled={loading}
                  >
                    <Ban className="mr-2 h-4 w-4" />
                    Otkaži Rezervaciju
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false)
                    form.reset()
                    setSelectedPassenger(null)
                    setShowPassengerForm(false)
                  }}
                  disabled={loading}
                >
                  <X className="mr-2 h-4 w-4" />
                  Otkaži
                </Button>
                {assignmentMode === "single" || !showAssignmentMode ? (
                  <Button type="submit" disabled={loading}>
                    {isEdit ? (
                      <Save className="mr-2 h-4 w-4" />
                    ) : (
                      <Check className="mr-2 h-4 w-4" />
                    )}
                    {loading
                      ? isEdit
                        ? "Čuvanje..."
                        : "Rezervisanje..."
                      : isEdit
                      ? "Sačuvaj Izmene"
                      : isMultipleSeatsSelection
                      ? "Kreiraj rezervacije"
                      : "Kreiraj rezervaciju"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    disabled={loading}
                    onClick={handlePerSeatSubmit}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    {loading ? "Rezervisanje..." : "Kreiraj Rezervacije"}
                  </Button>
                )}
              </div>
            </DialogFooter>
          </form>
        </Form>

        <Dialog open={showPassengerForm} onOpenChange={setShowPassengerForm}>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>Dodaj Novog Putnika</DialogTitle>
              <DialogDescription>
                Unesite informacije o putniku.
              </DialogDescription>
            </DialogHeader>
            <PassengerForm
              onSubmit={handleAddNewPassenger}
              onCancel={() => {
                setShowPassengerForm(false)
              }}
            />
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}
