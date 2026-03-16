"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { stationSchema } from "@/utils/validators"
import type { CreateStationDto, UpdateStationDto } from "@/infrastructure/generated/model"
import type { StationListItem } from "@/infrastructure/hooks/queries/useStationsListQuery"
import type { z } from "zod"
import { DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
} from "@/components/ui/form"
import { FormModalShell } from "@/components/forms/FormModalShell"
import { MapPinPlus, Save, X } from "lucide-react"

type StationFormValues = z.infer<typeof stationSchema>

const STATION_DEFAULT_VALUES: StationFormValues = {
  name: "",
  address: "",
  category: undefined,
  contactPhone: "",
  notes: "",
}

function getStationFormValues(station?: StationListItem | null): StationFormValues {
  if (!station) {
    return STATION_DEFAULT_VALUES
  }

  return {
    name: station.name,
    address: station.address,
    category: station.category ?? undefined,
    contactPhone: typeof station.contactPhone === "string" ? station.contactPhone : "",
    notes: typeof station.notes === "string" ? station.notes : "",
  }
}

function toCreatePayload(values: StationFormValues): CreateStationDto {
  return {
    name: values.name,
    address: values.address,
    category: values.category,
    contactPhone: values.contactPhone || undefined,
    notes: values.notes || undefined,
  }
}

function toUpdatePayload(values: StationFormValues): UpdateStationDto {
  return toCreatePayload(values)
}

interface StationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  station?: StationListItem | null
  readOnly?: boolean
  loading: boolean
  onCreate: (payload: CreateStationDto) => Promise<void>
  onUpdate: (id: string, payload: UpdateStationDto) => Promise<void>
}

export function StationModal({
  open,
  onOpenChange,
  station,
  readOnly = false,
  loading,
  onCreate,
  onUpdate,
}: StationModalProps) {
  const isEdit = !!station

  const form = useForm<StationFormValues>({
    resolver: zodResolver(stationSchema),
    defaultValues: STATION_DEFAULT_VALUES,
  })

  useEffect(() => {
    form.reset(getStationFormValues(station))
  }, [station, form])

  const onSubmit = async (data: StationFormValues) => {
    if (readOnly) {
      return
    }

    try {
      if (isEdit && station) {
        await onUpdate(station.id, toUpdatePayload(data))
      } else {
        await onCreate(toCreatePayload(data))
      }
      onOpenChange(false)
      form.reset(STATION_DEFAULT_VALUES)
    } catch (error) {
      // Error toast is handled in mutation hook.
    }
  }

  return (
    <FormModalShell
      open={open}
      onOpenChange={onOpenChange}
      title={readOnly ? "Pregled Stanice" : isEdit ? "Izmeni Stanicu" : "Dodaj Novu Stanicu"}
      description={readOnly
        ? "Pregled informacija o stanici."
        : isEdit
        ? "Izmenite informacije o stanici."
        : "Unesite informacije o novoj stanici."}
      contentClassName="sm:max-w-[600px]"
    >

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Naziv Stanice *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Unesite naziv stanice"
                      disabled={readOnly}
                      className={readOnly ? "disabled:opacity-100 disabled:text-foreground" : undefined}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresa *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Unesite adresu stanice"
                      rows={3}
                      disabled={readOnly}
                      className={readOnly ? "disabled:opacity-100 disabled:text-foreground" : undefined}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kategorija</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={readOnly}>
                    <FormControl>
                      <SelectTrigger className={readOnly ? "disabled:opacity-100" : undefined}>
                        <SelectValue placeholder="Izaberite kategoriju" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="BUS_STATION">Autobuska stanica</SelectItem>
                      <SelectItem value="BUS_STOP">Stajaliste</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kontakt telefon</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="+381 64 123 4567"
                      disabled={readOnly}
                      className={readOnly ? "disabled:opacity-100 disabled:text-foreground" : undefined}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Napomene</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Dodatne napomene o stanici"
                      rows={3}
                      disabled={readOnly}
                      className={readOnly ? "disabled:opacity-100 disabled:text-foreground" : undefined}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false)
                  form.reset(STATION_DEFAULT_VALUES)
                }}
                disabled={loading}
              >
                <X className="mr-2 h-4 w-4" />
                {readOnly ? "Zatvori" : "Otkaži"}
              </Button>
              {!readOnly && (
                <Button type="submit" disabled={loading}>
                  {isEdit ? (
                    <Save className="mr-2 h-4 w-4" />
                  ) : (
                    <MapPinPlus className="mr-2 h-4 w-4" />
                  )}
                  {loading
                    ? isEdit
                      ? "Čuvanje..."
                      : "Kreiranje..."
                    : isEdit
                    ? "Sačuvaj Izmene"
                    : "Kreiraj Stanicu"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
    </FormModalShell>
  )
}










