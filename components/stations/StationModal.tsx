"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { stationSchema } from "@/utils/validators"
import type { Station, StationFormData } from "@/types"
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
import { MapPinPlus, Save, X } from "lucide-react"

interface StationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  station?: Station | null
  readOnly?: boolean
}

export function StationModal({ open, onOpenChange, station, readOnly = false }: StationModalProps) {
  const { createStation, updateStation, loading } = useStationsStore()
  const isEdit = !!station

  const form = useForm<StationFormData>({
    resolver: zodResolver(stationSchema),
    defaultValues: {
      name: "",
      address: "",
      category: undefined,
      contactPhone: "",
      notes: "",
    },
  })

  useEffect(() => {
    if (station) {
      form.reset({
        name: station.name,
        address: station.address,
        category: station.category,
        contactPhone: station.contactPhone || "",
        notes: station.notes || "",
      })
    } else {
      form.reset({
        name: "",
        address: "",
        category: undefined,
        contactPhone: "",
        notes: "",
      })
    }
  }, [station, form])

  const onSubmit = async (data: StationFormData) => {
    if (readOnly) {
      return
    }

    try {
      if (isEdit && station) {
        await updateStation(station.id, data)
      } else {
        await createStation(data)
      }
      onOpenChange(false)
      form.reset()
    } catch (error) {
      // Error is handled in store
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {readOnly ? "Pregled Stanice" : isEdit ? "Izmeni Stanicu" : "Dodaj Novu Stanicu"}
          </DialogTitle>
          <DialogDescription>
            {readOnly
              ? "Pregled informacija o stanici."
              : isEdit
              ? "Izmenite informacije o stanici."
              : "Unesite informacije o novoj stanici."}
          </DialogDescription>
        </DialogHeader>

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
                      <SelectItem value="Autobuska stanica">Autobuska stanica</SelectItem>
                      <SelectItem value="Stajalište">Stajalište</SelectItem>
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
                  form.reset()
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
      </DialogContent>
    </Dialog>
  )
}










