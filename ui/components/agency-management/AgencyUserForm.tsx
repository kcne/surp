"use client"

import { useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { createAgencyUserSchema, updateAgencyUserSchema } from "@/utils/validators"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { AgencyUserFormData } from "@/components/agency-management/types"
import { Eye, EyeOff, Save, UserPlus, X } from "lucide-react"

interface AgencyUserFormProps {
  isEdit: boolean
  onSubmit: (data: AgencyUserFormData) => Promise<void>
  onCancel: () => void
  initialData?: Partial<AgencyUserFormData>
  loading?: boolean
}

export function AgencyUserForm({
  isEdit,
  onSubmit,
  onCancel,
  initialData,
  loading = false,
}: AgencyUserFormProps) {
  const [showPassword, setShowPassword] = useState(false)

  const resolver = useMemo(
    () => zodResolver(isEdit ? updateAgencyUserSchema : createAgencyUserSchema),
    [isEdit]
  )

  const form = useForm<AgencyUserFormData>({
    resolver,
    defaultValues: {
      username: "",
      email: "",
      role: "STAFF",
      password: "",
      isActive: true,
      ...initialData,
    },
  })

  const handleSaveClick = async () => {
    const isValid = await form.trigger()
    if (!isValid) {
      return
    }

    await onSubmit(form.getValues())
  }

  return (
    <Form {...form}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Korisničko ime *</FormLabel>
                <FormControl>
                  <Input placeholder="Unesite korisničko ime" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email *</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="korisnik@agencija.rs" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rola *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Izaberite rolu" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="MANAGER">Menadžer</SelectItem>
                    <SelectItem value="STAFF">Osoblje</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {!isEdit ? (
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lozinka *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Unesite lozinku"
                        className="pr-10"
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        disabled={loading}
                        aria-label={showPassword ? "Sakrij lozinku" : "Prikaži lozinku"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormDescription>Minimum 8 karaktera</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Aktivan nalog</FormLabel>
                    <FormDescription>Neaktivni korisnici ne mogu da se prijave.</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            <X className="mr-2 h-4 w-4" />
            Otkaži
          </Button>
          <Button type="button" onClick={handleSaveClick} disabled={loading}>
            {loading ? <Save className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />}
            {loading ? "Čuvanje..." : isEdit ? "Sačuvaj Izmene" : "Kreiraj Korisnika"}
          </Button>
        </div>
      </div>
    </Form>
  )
}
