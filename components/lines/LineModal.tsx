"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { lineSchema } from "@/utils/validators"
import type { Line, LineFormData } from "@/types"
import { useLinesStore } from "@/stores/linesStore"
import { useStationsStore } from "@/stores/stationsStore"
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
import { PlusCircle, Save, X } from "lucide-react"

interface LineModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  line?: Line | null
}

export function LineModal({ open, onOpenChange, line }: LineModalProps) {
  const { createLine, updateLine, loading } = useLinesStore()
  const { stations, fetchStations } = useStationsStore()
  const isEdit = !!line

  // Fetch stations when modal opens to ensure all stations are available
  useEffect(() => {
    if (open) {
      fetchStations()
    }
  }, [open, fetchStations])

  const form = useForm<LineFormData>({
    resolver: zodResolver(lineSchema),
    defaultValues: {
      name: "",
      departureStationId: "",
      arrivalStationId: "",
      intermediateStationIds: [],
      directionMode: "both",
      distance: undefined,
      duration: undefined,
      basePrice: undefined,
      isActive: true,
    },
  })

  useEffect(() => {
    if (line) {
      form.reset({
        name: line.name,
        departureStationId: line.departureStation.id,
        arrivalStationId: line.arrivalStation.id,
        intermediateStationIds: line.intermediateStations.map((s) => s.stationId),
        directionMode: line.directionMode || "single",
        distance: line.distance,
        duration: line.duration,
        basePrice: line.basePrice,
        isActive: line.isActive,
      })
    } else {
      form.reset({
        name: "",
        departureStationId: "",
        arrivalStationId: "",
        intermediateStationIds: [],
        directionMode: "both",
        distance: undefined,
        duration: undefined,
        basePrice: undefined,
        isActive: true,
      })
    }
  }, [line, form])

  const onSubmit = async (data: LineFormData) => {
    try {
      const departureStation = stations.find((station) => station.id === data.departureStationId)
      const arrivalStation = stations.find((station) => station.id === data.arrivalStationId)
      const autoName = departureStation && arrivalStation
        ? `${departureStation.name} - ${arrivalStation.name}`
        : ""

      if (isEdit && line) {
        await updateLine(line.id, { ...data, name: autoName })
      } else {
        await createLine({ ...data, name: autoName })
      }
      onOpenChange(false)
      form.reset()
    } catch (error) {
      // Error is handled in store
    }
  }

  const intermediateStationIds = form.watch("intermediateStationIds") || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Izmeni Liniju" : "Dodaj Novu Liniju"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Izmenite informacije o liniji."
              : "Unesite informacije o novoj liniji."}
          </DialogDescription>
        </DialogHeader>

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
                            (s) => s.id !== form.watch("arrivalStationId")
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
                            (s) => s.id !== form.watch("departureStationId")
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
              name="intermediateStationIds"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <IntermediateStationsList
                      selectedStationIds={field.value || []}
                      onChange={field.onChange}
                      departureStationId={form.watch("departureStationId")}
                      arrivalStationId={form.watch("arrivalStationId")}
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
      </DialogContent>
    </Dialog>
  )
}

