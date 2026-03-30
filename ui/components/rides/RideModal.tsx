"use client"

import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { rideSchema } from "@/utils/validators"
import type { DayScheduleStationTime, Ride, RideFormData } from "@/types"
import { useLinesListQuery } from "@/infrastructure/hooks/queries/useLinesListQuery"
import { DialogFooter } from "@/components/ui/dialog"
import { FormModalShell } from "@/components/forms/FormModalShell"
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { srLatn } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { formatDateToISO } from "@/utils/dateHelpers"
import { BusFront, Save, X } from "lucide-react"

interface RideModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ride?: Ride | null
  loading: boolean
  onCreate: (payload: RideFormData) => Promise<void>
  onUpdate: (id: string, payload: Partial<RideFormData>) => Promise<void>
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Nedelja" },
  { value: 1, label: "Ponedeljak" },
  { value: 2, label: "Utorak" },
  { value: 3, label: "Sreda" },
  { value: 4, label: "Četvrtak" },
  { value: 5, label: "Petak" },
  { value: 6, label: "Subota" },
]

type RouteStation = {
  stationId: string
  stationName: string
  orderIndex: number
}

function toRouteStations(line?: Ride["line"]): RouteStation[] {
  if (!line) {
    return []
  }

  return [
    {
      stationId: line.departureStation.id,
      stationName: line.departureStation.name,
      orderIndex: 0,
    },
    ...line.intermediateStations
      .sort((left, right) => left.order - right.order)
      .map((station, index) => ({
        stationId: station.stationId,
        stationName: station.stationName,
        orderIndex: index + 1,
      })),
    {
      stationId: line.arrivalStation.id,
      stationName: line.arrivalStation.name,
      orderIndex: line.intermediateStations.length + 1,
    },
  ]
}

export function RideModal({
  open,
  onOpenChange,
  ride,
  loading,
  onCreate,
  onUpdate,
}: RideModalProps) {
  const linesQuery = useLinesListQuery()
  const lines = useMemo(() => linesQuery.data ?? [], [linesQuery.data])
  const isEdit = !!ride
  const todayIso = formatDateToISO(new Date())

  const form = useForm<RideFormData>({
    resolver: zodResolver(rideSchema),
    defaultValues: {
      lineId: "",
      busCapacity: 38,
      type: "recurring",
      status: "scheduled",
      startDate: todayIso,
      endDate: undefined,
      daysOfWeek: [],
      daySchedules: {},
      exceptions: [],
      date: undefined,
      oneTimeDepartureTime: "",
      oneTimeArrivalTime: "",
    },
  })

  const rideType = form.watch("type")
  const lineId = form.watch("lineId")
  const watchedDaysOfWeek = form.watch("daysOfWeek")
  const daysOfWeek = useMemo(() => watchedDaysOfWeek ?? [], [watchedDaysOfWeek])
  const daySchedules = form.watch("daySchedules") || {}
  const selectedLine = useMemo(() => lines.find((line) => line.id === lineId), [lineId, lines])
  const routeStations = useMemo(() => toRouteStations(selectedLine), [selectedLine])

  // Ensure daySchedules contain station rows for all selected days and current line
  useEffect(() => {
    if (rideType !== "recurring") {
      return
    }

    const currentSchedules = form.getValues("daySchedules") || {}
    const nextSchedules: Record<string, DayScheduleStationTime[]> = {}

    daysOfWeek.forEach((day) => {
      const existing =
        currentSchedules[day] ||
        (currentSchedules as Record<string, DayScheduleStationTime[]>)[String(day)] ||
        []
      const existingByStationId = new Map(existing.map((item) => [item.stationId, item.time || ""]))

      nextSchedules[String(day)] = routeStations.map((station) => ({
        stationId: station.stationId,
        stationName: station.stationName,
        orderIndex: station.orderIndex,
        time: existingByStationId.get(station.stationId) || "",
      }))
    })

    const currentSelected = daysOfWeek.reduce<Record<string, DayScheduleStationTime[]>>((acc, day) => {
      acc[String(day)] =
        currentSchedules[day] ||
        (currentSchedules as Record<string, DayScheduleStationTime[]>)[String(day)] ||
        []
      return acc
    }, {})

    if (JSON.stringify(currentSelected) !== JSON.stringify(nextSchedules)) {
      form.setValue("daySchedules", nextSchedules as any, { shouldValidate: false })
    }
  }, [daysOfWeek, form, rideType, routeStations])

  useEffect(() => {
    if (ride) {
      form.reset({
        lineId: ride.line.id,
        busCapacity: ride.busCapacity,
        type: ride.type,
        status: ride.status,
        startDate: ride.startDate,
        endDate: ride.endDate,
        daysOfWeek: ride.daysOfWeek || [],
        daySchedules: ride.daySchedules || {},
        exceptions: ride.exceptions || [],
        date: ride.date,
        oneTimeDepartureTime: ride.oneTimeDepartureTime || "",
        oneTimeArrivalTime: ride.oneTimeArrivalTime || "",
      })
    } else {
      form.reset({
        lineId: "",
        busCapacity: 38,
        type: "recurring",
        status: "scheduled",
        startDate: todayIso,
        endDate: undefined,
        daysOfWeek: [],
        daySchedules: {},
        exceptions: [],
        date: undefined,
        oneTimeDepartureTime: "",
        oneTimeArrivalTime: "",
      })
    }
  }, [ride, form, todayIso])

  const onSubmit = async (data: RideFormData) => {
    try {
      if (data.type === "recurring") {
        const normalizedDaySchedules: Record<string, DayScheduleStationTime[]> = {}

        ;(data.daysOfWeek || []).forEach((day) => {
          const stationTimes =
            data.daySchedules?.[day] ||
            (data.daySchedules as Record<string, DayScheduleStationTime[]> | undefined)?.[String(day)] ||
            []

          normalizedDaySchedules[String(day)] = stationTimes
            .map((stationTime) => ({
              stationId: stationTime.stationId,
              stationName: stationTime.stationName,
              orderIndex: stationTime.orderIndex,
              time: stationTime.time || "",
            }))
            .sort((left, right) => left.orderIndex - right.orderIndex)
        })

        data.daySchedules = normalizedDaySchedules as any
      }

      if (isEdit && ride) {
        await onUpdate(ride.id, data)
      } else {
        await onCreate(data)
      }
      onOpenChange(false)
      form.reset()
    } catch (error) {
      // Error is handled in store
      console.error("Error submitting ride:", error)
    }
  }

  return (
    <FormModalShell
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Izmeni Vožnju" : "Dodaj Novu Vožnju"}
      description={isEdit
        ? "Izmenite informacije o vožnji."
        : "Unesite informacije o novoj vožnji."}
      contentClassName="sm:max-w-[800px] max-h-[90vh] overflow-y-auto"
    >

        <Form {...form}>
          <form 
            onSubmit={form.handleSubmit(onSubmit, (errors) => {
              console.error("Form validation errors:", errors)
            })} 
            className="space-y-6"
          >
            {/* Osnovne Informacije */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Osnovne Informacije</h3>

              <FormField
                control={form.control}
                name="lineId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Linija *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Izaberite liniju" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {lines.map((line) => (
                          <SelectItem key={line.id} value={line.id}>
                            {line.name}
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
                name="busCapacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kapacitet Autobusa</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 38)}
                        value={field.value || 38}
                      />
                    </FormControl>
                    <FormDescription>Broj sedišta u autobusu</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Tip Vožnje */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Tip Vožnje</h3>
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex flex-col space-y-1"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="recurring" id="recurring" />
                          <Label htmlFor="recurring" className="font-normal cursor-pointer">
                            Ponavljajuća
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="one-time" id="one-time" />
                          <Label htmlFor="one-time" className="font-normal cursor-pointer">
                            Jednokratna
                          </Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Ponavljajuća Vožnja */}
            {rideType === "recurring" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Ponavljajuća Vožnja</h3>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Datum Početka *</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(new Date(field.value + "T00:00:00"), "PPP", { locale: srLatn })
                                ) : (
                                  <span>Izaberite datum</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value ? new Date(field.value + "T00:00:00") : undefined}
                              onSelect={(date) => {
                                field.onChange(date ? formatDateToISO(date) : undefined)
                              }}
                              locale={srLatn}
                              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Datum Završetka (opciono)</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(new Date(field.value + "T00:00:00"), "PPP", { locale: srLatn })
                                ) : (
                                  <span>Izaberite datum</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value ? new Date(field.value + "T00:00:00") : undefined}
                              onSelect={(date) => {
                                field.onChange(date ? formatDateToISO(date) : undefined)
                              }}
                              locale={srLatn}
                              disabled={(date) => {
                                const startDate = form.watch("startDate")
                                if (startDate) {
                                  return date < new Date(startDate + "T00:00:00")
                                }
                                return date < new Date(new Date().setHours(0, 0, 0, 0))
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="daysOfWeek"
                  render={() => (
                    <FormItem>
                      <div className="mb-4">
                        <FormLabel className="text-base">Dani u Nedelji *</FormLabel>
                        <FormDescription>
                          Izaberite dane kada se vožnja ponavlja
                        </FormDescription>
                      </div>
                      {DAYS_OF_WEEK.map((day) => (
                        <FormField
                          key={day.value}
                          control={form.control}
                          name="daysOfWeek"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={day.value}
                                className="flex flex-row items-start space-x-3 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(day.value)}
                                    onCheckedChange={(checked) => {
                                      const newDays = checked
                                        ? [...(field.value || []), day.value]
                                        : field.value?.filter((value) => value !== day.value) || []
                                      field.onChange(newDays)
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">
                                  {day.label}
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                      ))}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Vremena za svaki selektovani dan */}
                {daysOfWeek.length > 0 && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-base">Vremena po Stanicama za Svaki Dan *</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Unesite vreme za svaku stanicu na liniji za svaki selektovani dan
                      </p>
                    </div>

                    {!selectedLine && (
                      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                        Prvo izaberite liniju da bi se prikazale stanice za unos vremena.
                      </div>
                    )}

                    {daysOfWeek.map((dayValue) => {
                      const day = DAYS_OF_WEEK.find((d) => d.value === dayValue)
                      if (!day) return null

                      const stationTimes =
                        daySchedules[dayValue] ||
                        (daySchedules as Record<string, DayScheduleStationTime[]>)[String(dayValue)] ||
                        []
                      
                      return (
                        <div key={dayValue} className="space-y-3 p-4 border rounded-lg">
                          <Label className="font-semibold">{day.label}</Label>
                          <div className="space-y-3">
                            {stationTimes.map((stationTime, stationIndex) => (
                              <div
                                key={`${dayValue}-${stationTime.stationId}`}
                                className="grid grid-cols-[1fr_220px] gap-3 items-center"
                              >
                                <div className="text-sm font-medium">
                                  {stationTime.stationName || stationTime.stationId}
                                </div>
                                <FormField
                                  control={form.control}
                                  name={`daySchedules.${dayValue}.${stationIndex}.time` as any}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input
                                          type="time"
                                          value={field.value || stationTime.time || ""}
                                          onChange={(e) => {
                                            const currentSchedules = form.getValues("daySchedules") || {}
                                            const currentDay =
                                              currentSchedules[dayValue] ||
                                              (currentSchedules as Record<string, DayScheduleStationTime[]>)[String(dayValue)] ||
                                              []
                                            const nextDay = [...currentDay]
                                            nextDay[stationIndex] = {
                                              ...nextDay[stationIndex],
                                              stationId: stationTime.stationId,
                                              stationName: stationTime.stationName,
                                              orderIndex: stationTime.orderIndex,
                                              time: e.target.value,
                                            }
                                            form.setValue(
                                              "daySchedules",
                                              {
                                                ...currentSchedules,
                                                [dayValue]: nextDay,
                                              } as any,
                                              { shouldValidate: true }
                                            )
                                            field.onChange(e.target.value)
                                          }}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Jednokratna Vožnja */}
            {rideType === "one-time" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Jednokratna Vožnja</h3>

                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Datum *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(new Date(field.value + "T00:00:00"), "PPP", { locale: srLatn })
                              ) : (
                                <span>Izaberite datum</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ? new Date(field.value + "T00:00:00") : undefined}
                            onSelect={(date) => {
                              field.onChange(date ? formatDateToISO(date) : undefined)
                            }}
                            locale={srLatn}
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="oneTimeDepartureTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vreme Polaska *</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="oneTimeArrivalTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vreme Dolaska *</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            {/* Status */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Izaberite status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="scheduled">Zakazana</SelectItem>
                      <SelectItem value="completed">Završena</SelectItem>
                      <SelectItem value="cancelled">Otkazana</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Debug: Show form errors */}
            {Object.keys(form.formState.errors).length > 0 && (
              <div className="rounded-md bg-destructive/10 p-4">
                <p className="text-sm font-medium text-destructive mb-2">
                  Greške u formi:
                </p>
                <ul className="text-sm text-destructive list-disc list-inside">
                  {Object.entries(form.formState.errors).map(([key, error]) => (
                    <li key={key}>
                      {key}: {error?.message as string}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false)
                  form.reset()
                }}
                disabled={loading}
              >
                <X className="mr-2 h-4 w-4" />
                Otkaži
              </Button>
              <Button type="submit" disabled={loading}>
                {isEdit ? (
                  <Save className="mr-2 h-4 w-4" />
                ) : (
                  <BusFront className="mr-2 h-4 w-4" />
                )}
                {loading
                  ? isEdit
                    ? "Čuvanje..."
                    : "Kreiranje..."
                  : isEdit
                  ? "Sačuvaj Izmene"
                  : "Kreiraj Vožnju"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
    </FormModalShell>
  )
}

