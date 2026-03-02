"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { rideSchema } from "@/utils/validators"
import type { Ride, RideFormData } from "@/types"
import { useRidesStore } from "@/stores/ridesStore"
import { useLinesStore } from "@/stores/linesStore"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { cn } from "@/lib/utils"
import { formatDateToISO } from "@/utils/dateHelpers"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { BusFront, Save, X } from "lucide-react"

interface RideModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ride?: Ride | null
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

export function RideModal({ open, onOpenChange, ride }: RideModalProps) {
  const { createRide, updateRide, loading } = useRidesStore()
  const { lines } = useLinesStore()
  const isEdit = !!ride

  const form = useForm<RideFormData>({
    resolver: zodResolver(rideSchema),
    defaultValues: {
      lineId: "",
      busCapacity: 38,
      type: "recurring",
      status: "scheduled",
      startDate: undefined,
      endDate: undefined,
      daysOfWeek: [],
      departureTime: "",
      arrivalTime: "",
      dayTimes: {},
      exceptions: [],
      date: undefined,
      oneTimeDepartureTime: "",
      oneTimeArrivalTime: "",
    },
  })

  const rideType = form.watch("type")
  const daysOfWeek = form.watch("daysOfWeek") || []
  const dayTimes = form.watch("dayTimes") || {}

  // Ensure dayTimes structure exists for all selected days
  useEffect(() => {
    if (rideType === "recurring" && daysOfWeek.length > 0) {
      const currentDayTimes = form.getValues("dayTimes") || {}
      const updatedDayTimes = { ...currentDayTimes }
      let hasChanges = false

      daysOfWeek.forEach((day) => {
        if (!updatedDayTimes[day]) {
          updatedDayTimes[day] = { departureTime: "", arrivalTime: "" }
          hasChanges = true
        }
      })

      // Remove times for unselected days
      Object.keys(updatedDayTimes).forEach((dayStr) => {
        const day = parseInt(dayStr)
        if (!daysOfWeek.includes(day)) {
          delete updatedDayTimes[day]
          hasChanges = true
        }
      })

      if (hasChanges) {
        form.setValue("dayTimes", updatedDayTimes as any, { shouldValidate: false })
      }
    }
  }, [daysOfWeek, rideType, form])

  useEffect(() => {
    if (ride) {
      // Convert old format (departureTime/arrivalTime) to new format (dayTimes) if needed
      let dayTimes: Record<number, { departureTime: string; arrivalTime: string }> = {}
      if (ride.dayTimes) {
        dayTimes = ride.dayTimes
      } else if (ride.departureTime && ride.arrivalTime && ride.daysOfWeek) {
        // Migrate old format to new format
        ride.daysOfWeek.forEach((day) => {
          dayTimes[day] = {
            departureTime: ride.departureTime!,
            arrivalTime: ride.arrivalTime!,
          }
        })
      }

      form.reset({
        lineId: ride.line.id,
        busCapacity: ride.busCapacity,
        type: ride.type,
        status: ride.status,
        startDate: ride.startDate,
        endDate: ride.endDate,
        daysOfWeek: ride.daysOfWeek || [],
        departureTime: ride.departureTime || "",
        arrivalTime: ride.arrivalTime || "",
        dayTimes,
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
        startDate: undefined,
        endDate: undefined,
        daysOfWeek: [],
        departureTime: "",
        arrivalTime: "",
        dayTimes: {},
        exceptions: [],
        date: undefined,
        oneTimeDepartureTime: "",
        oneTimeArrivalTime: "",
      })
    }
  }, [ride, form])

  const onSubmit = async (data: RideFormData) => {
    try {
      // Ensure dayTimes structure is correct before submission
      // Convert string keys to numbers for storage
      if (data.type === "recurring" && data.daysOfWeek && data.daysOfWeek.length > 0 && data.dayTimes) {
        const dayTimes = data.dayTimes || {}
        // Convert string keys to number keys
        const updatedDayTimes: Record<number, { departureTime: string; arrivalTime: string }> = {}
        data.daysOfWeek.forEach((day) => {
          // React Hook Form uses string keys, so convert day to string for lookup
          const dayTime = (dayTimes as any)[String(day)] || (dayTimes as any)[day]
          if (dayTime && dayTime.departureTime && dayTime.arrivalTime) {
            updatedDayTimes[day] = dayTime
          }
        })
        data.dayTimes = updatedDayTimes as any
      }

      if (isEdit && ride) {
        await updateRide(ride.id, data)
      } else {
        await createRide(data)
      }
      onOpenChange(false)
      form.reset()
    } catch (error) {
      // Error is handled in store
      console.error("Error submitting ride:", error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Izmeni Vožnju" : "Dodaj Novu Vožnju"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Izmenite informacije o vožnji."
              : "Unesite informacije o novoj vožnji."}
          </DialogDescription>
        </DialogHeader>

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
                                  format(new Date(field.value + "T00:00:00"), "PPP", { locale: undefined })
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
                                  format(new Date(field.value + "T00:00:00"), "PPP", { locale: undefined })
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
                                      
                                      // Update dayTimes when days change
                                      const currentDayTimes = form.getValues("dayTimes") || {}
                                      if (checked) {
                                        // Add default times for new day if not exists
                                        if (!currentDayTimes[day.value]) {
                                          // Try to copy from first existing day, or use empty strings
                                          const firstDayKey = Object.keys(currentDayTimes)[0]
                                          const defaultTimes = firstDayKey
                                            ? currentDayTimes[parseInt(firstDayKey)]
                                            : { departureTime: "", arrivalTime: "" }
                                          
                                          const updatedDayTimes = {
                                            ...currentDayTimes,
                                            [day.value]: {
                                              departureTime: defaultTimes?.departureTime || "",
                                              arrivalTime: defaultTimes?.arrivalTime || "",
                                            }
                                          }
                                          form.setValue("dayTimes", updatedDayTimes as any, { shouldValidate: false })
                                        }
                                      } else {
                                        // Remove times for unselected day
                                        const { [day.value]: removed, ...rest } = currentDayTimes
                                        form.setValue("dayTimes", rest as any, { shouldValidate: false })
                                      }
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
                      <Label className="text-base">Vremena za Svaki Dan *</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Unesite vreme polaska i dolaska za svaki selektovani dan
                      </p>
                    </div>
                    {daysOfWeek.map((dayValue) => {
                      const day = DAYS_OF_WEEK.find((d) => d.value === dayValue)
                      if (!day) return null
                      
                      return (
                        <div key={dayValue} className="space-y-2 p-4 border rounded-lg">
                          <Label className="font-semibold">{day.label}</Label>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name={`dayTimes.${dayValue}.departureTime` as any}
                              render={({ field }) => {
                                const dayTimes = form.watch("dayTimes") || {}
                                const dayTime = dayTimes[dayValue] || { departureTime: "", arrivalTime: "" }
                                const value = dayTime.departureTime || field.value || ""
                                
                                return (
                                  <FormItem>
                                    <FormLabel>Vreme Polaska *</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="time"
                                        value={value}
                                        onChange={(e) => {
                                          const updatedDayTimes = {
                                            ...dayTimes,
                                            [dayValue]: {
                                              ...dayTime,
                                              departureTime: e.target.value,
                                            },
                                          }
                                          form.setValue("dayTimes", updatedDayTimes as any, { shouldValidate: true })
                                          field.onChange(e.target.value)
                                        }}
                                        onBlur={field.onBlur}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )
                              }}
                            />

                            <FormField
                              control={form.control}
                              name={`dayTimes.${dayValue}.arrivalTime` as any}
                              render={({ field }) => {
                                const dayTimes = form.watch("dayTimes") || {}
                                const dayTime = dayTimes[dayValue] || { departureTime: "", arrivalTime: "" }
                                const value = dayTime.arrivalTime || field.value || ""
                                
                                return (
                                  <FormItem>
                                    <FormLabel>Vreme Dolaska *</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="time"
                                        value={value}
                                        onChange={(e) => {
                                          const updatedDayTimes = {
                                            ...dayTimes,
                                            [dayValue]: {
                                              ...dayTime,
                                              arrivalTime: e.target.value,
                                            },
                                          }
                                          form.setValue("dayTimes", updatedDayTimes as any, { shouldValidate: true })
                                          field.onChange(e.target.value)
                                        }}
                                        onBlur={field.onBlur}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )
                              }}
                            />
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
                                format(new Date(field.value + "T00:00:00"), "PPP", { locale: undefined })
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
      </DialogContent>
    </Dialog>
  )
}

