"use client"

import { useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { FormModalShell } from "@/components/forms/FormModalShell"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { resetAgencyUserPasswordSchema } from "@/utils/validators"
import type {
  AgencyUser,
  ResetAgencyUserPasswordFormData,
  ResetAgencyUserPasswordPayload,
} from "@/components/agency-management/types"
import { Eye, EyeOff, KeyRound, Save, X } from "lucide-react"

interface ResetAgencyUserPasswordModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: AgencyUser | null
  loading?: boolean
  onSubmit: (id: string, payload: ResetAgencyUserPasswordPayload) => Promise<void>
}

export function ResetAgencyUserPasswordModal({
  open,
  onOpenChange,
  user,
  loading = false,
  onSubmit,
}: ResetAgencyUserPasswordModalProps) {
  const [showPassword, setShowPassword] = useState(false)
  const resolver = useMemo(() => zodResolver(resetAgencyUserPasswordSchema), [])

  const form = useForm<ResetAgencyUserPasswordFormData>({
    resolver,
    defaultValues: {
      newPassword: "",
      requirePasswordChange: true,
    },
  })

  const handleResetClick = async () => {
    if (!user) {
      return
    }

    const isValid = await form.trigger()
    if (!isValid) {
      return
    }

    await onSubmit(user.id, form.getValues())
    form.reset({ newPassword: "", requirePasswordChange: true })
    onOpenChange(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      form.reset({ newPassword: "", requirePasswordChange: true })
      setShowPassword(false)
    }

    onOpenChange(nextOpen)
  }

  return (
    <FormModalShell
      open={open}
      onOpenChange={handleOpenChange}
      title="Reset Lozinke"
      description={
        user
          ? `Postavite novu lozinku za korisnika ${user.username}.`
          : "Postavite novu lozinku za korisnika."
      }
      contentClassName="sm:max-w-[560px]"
    >
      <Form {...form}>
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nova lozinka *</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Unesite novu lozinku"
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

          <FormField
            control={form.control}
            name="requirePasswordChange"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Obavezna promena lozinke</FormLabel>
                  <FormDescription>
                    Ako je uključeno, korisnik mora da promeni lozinku pri sledećoj prijavi.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={loading} onClick={() => handleOpenChange(false)}>
              <X className="mr-2 h-4 w-4" />
              Otkaži
            </Button>
            <Button type="button" onClick={handleResetClick} disabled={loading || !user}>
              {loading ? <Save className="mr-2 h-4 w-4" /> : <KeyRound className="mr-2 h-4 w-4" />}
              {loading ? "Resetovanje..." : "Resetuj Lozinku"}
            </Button>
          </div>
        </div>
      </Form>
    </FormModalShell>
  )
}
