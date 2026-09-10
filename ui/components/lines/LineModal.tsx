"use client"

import { useEffect } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { lineSchema } from "@/utils/validators"
import type { Line, LineFormData } from "@/types"
import { useStationsListQuery } from "@/infrastructure/hooks/queries/useStationsListQuery"
import { toCreateLineDto, toUpdateLineDto } from "@/infrastructure/mappers/lineMappers"
import type { CreateLineDto, UpdateLineDto } from "@/infrastructure/generated/model"
import { DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
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
import { IntermediateStationsList } from "./IntermediateStationsList"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { FormModalShell } from "@/components/forms/FormModalShell"
import { PlusCircle, Save, X } from "lucide-react"

const LINE_DEFAULT_VALUES: LineFormData = {
  name: "",
  departureStationId: "",
  arrivalStationId: "",
  intermediateStops: [],
  directionMode: "both",
  distance: undefined,
  duration: undefined,
  basePrice: undefined,
  isActive: true,
}

function getLineFormValues(line?: Line | null): LineFormData {
  if (!line) {
    return LINE_DEFAULT_VALUES
  }

  return {
    name: line.name,
    departureStationId: line.departureStation.id,
    arrivalStationId: line.arrivalStation.id,
    intermediateStops: [...line.intermediateStations]
      .sort((left, right) => left.order - right.order)
      .map((station) => ({
        stationId: station.stationId,
        isBoarding: station.isBoarding,
        isDropoff: station.isDropoff,
      })),
    directionMode: line.directionMode || "single",
    distance: line.distance,
    duration: line.duration,
    basePrice: line.basePrice,
    isActive: line.isActive,
  }
}

interface LineModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  line?: Line | null
  loading: boolean
  onCreate: (payload: CreateLineDto) => Promise<void>
  onUpdate: (id: string, payload: UpdateLineDto) => Promise<void>
}

export function LineModal({
  open,
  onOpenChange,
  line,
  loading,
  onCreate,
  onUpdate,
}: LineModalProps) {
  const stationsQuery = useStationsListQuery()
  const stations = stationsQuery.data || []
  const isEdit = !!line

  const form = useForm<LineFormData>({
    resolver: zodResolver(lineSchema),
    defaultValues: LINE_DEFAULT_VALUES,
  })

  useEffect(() => {
    form.reset(getLineFormValues(line))
  }, [line, form])

  const onSubmit = async (data: LineFormData) => {
    try {
      const departureStation = stations.find((station) => station.id === data.departureStationId)
      const arrivalStation = stations.find((station) => station.id === data.arrivalStationId)
      const autoName = departureStation && arrivalStation
        ? `${departureStation.name} - ${arrivalStation.name}`
        : ""
      const payloadWithName = { ...data, name: autoName }

      if (isEdit && line) {
        await onUpdate(line.id, toUpdateLineDto(payloadWithName))
      } else {
        await onCreate(toCreateLineDto(payloadWithName))
      }
      onOpenChange(false)
      form.reset(LINE_DEFAULT_VALUES)
    } catch (error) {
      // Error is handled in store
    }
  }

  const departureStationId = useWatch({
    control: form.control,
    name: "departureStationId",
  })
  const arrivalStationId = useWatch({
    control: form.control,
    name: "arrivalStationId",
  })
  return (
    <FormModalShell
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Izmeni Liniju" : "Dodaj Novu Liniju"}
      description={isEdit && line
        ? `Izmenite smer ${line.departureStation.name} → ${line.arrivalStation.name}. Suprotan smer se menja iz svog reda u tabeli.`
        : "Unesite informacije o novoj liniji."}
      contentClassName="sm:max-w-[700px] max-h-[90vh] overflow-y-auto"
    >

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {!isEdit && (
              <FormField
                control={form.control}
                name="directionMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Smer linije</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "both"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Izaberite smer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="single">Jedan smer</SelectItem>
                        <SelectItem value="both">Oba smera</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
                        {stations
                          .filter(
                            (s) => s.id !== arrivalStationId
                          )
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
                        {stations
                          .filter(
                            (s) => s.id !== departureStationId
                          )
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
            </div>

            <FormField
              control={form.control}
              name="intermediateStops"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <IntermediateStationsList
                      stops={field.value || []}
                      onChange={field.onChange}
                      departureStationId={departureStationId}
                      arrivalStationId={arrivalStationId}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="metadata">
                <AccordionTrigger>Dodatne informacije</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="distance"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Udaljenost (km)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="0"
                              {...field}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value
                                    ? parseFloat(e.target.value)
                                    : undefined
                                )
                              }
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="duration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Trajanje (min)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="0"
                              {...field}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value
                                    ? parseFloat(e.target.value)
                                    : undefined
                                )
                              }
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="basePrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Osnovna Cena (RSD)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="0"
                              {...field}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value
                                    ? parseFloat(e.target.value)
                                    : undefined
                                )
                              }
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Status</FormLabel>
                    <FormDescription>
                      Aktivirajte ili deaktivirajte liniju
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

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
                  <PlusCircle className="mr-2 h-4 w-4" />
                )}
                {loading
                  ? isEdit
                    ? "Čuvanje..."
                    : "Kreiranje..."
                  : isEdit
                  ? "Sačuvaj Izmene"
                  : "Kreiraj Liniju"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
    </FormModalShell>
  )
}

