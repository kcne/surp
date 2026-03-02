"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { passengerSchema } from "@/utils/validators"
import type { PassengerFormData } from "@/types"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Save, UserPlus, X } from "lucide-react"

interface PassengerFormProps {
  onSubmit: (data: PassengerFormData) => Promise<void>
  onCancel: () => void
  initialData?: Partial<PassengerFormData>
  loading?: boolean
}

export function PassengerForm({
  onSubmit,
  onCancel,
  initialData,
  loading = false,
}: PassengerFormProps) {
  const form = useForm<PassengerFormData>({
    resolver: zodResolver(passengerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      idCardNumber: "",
      passengerType: "odrasli",
      address: "",
      notes: "",
      ...initialData,
    },
  })

  const handleSaveClick = async () => {
    // Validate form first
    const isValid = await form.trigger()
    if (!isValid) {
      return
    }

    const data = form.getValues()
    try {
      await onSubmit(data)
      // Form will be reset by parent component after passenger is created
    } catch (error) {
      // Error is handled in parent/store
      // Form stays open so user can fix and retry
    }
  }

  return (
    <Form {...form}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ime *</FormLabel>
                <FormControl>
                  <Input placeholder="Unesite ime" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prezime *</FormLabel>
                <FormControl>
                  <Input placeholder="Unesite prezime" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefon *</FormLabel>
                <FormControl>
                  <Input placeholder="+381 64 123 4567" {...field} />
                </FormControl>
                <FormDescription>Format: +381 64 123 4567</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="email@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="idCardNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Broj Lične Karte</FormLabel>
                <FormControl>
                  <Input placeholder="123456789" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="passengerType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tip Putnika *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || "odrasli"}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Izaberite tip putnika" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="dete">Dete</SelectItem>
                    <SelectItem value="odrasli">Odrasli</SelectItem>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="penzioner">Penzioner</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Adresa</FormLabel>
              <FormControl>
                <Textarea placeholder="Unesite adresu" rows={3} {...field} />
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
                <Textarea placeholder="Dodatne napomene" rows={3} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            <X className="mr-2 h-4 w-4" />
            Otkaži
          </Button>
          <Button type="button" onClick={handleSaveClick} disabled={loading}>
            {loading ? (
              <Save className="mr-2 h-4 w-4" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" />
            )}
            {loading ? "Čuvanje..." : "Sačuvaj Putnika"}
          </Button>
        </div>
      </div>
    </Form>
  )
}

