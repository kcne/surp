"use client"

import { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useAuthStore } from "@/stores/authStore"
import type { PlatformTenantLoginOption } from "@/infrastructure/types/auth.types"
import { useTenantLoginOptionsQuery } from "@/infrastructure/hooks/queries/useTenantLoginOptionsQuery"
import { getApiErrorMessage } from "@/infrastructure/utils/errors"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { Check, ChevronsUpDown, Eye, EyeOff, LogIn } from "lucide-react"
import { toast } from "sonner"

const loginSchema = z.object({
  tenantSlug: z.string().min(1, "Agencija je obavezna"),
  email: z.string().min(1, "Email je obavezan").email("Unesite ispravan email"),
  password: z.string().min(1, "Lozinka je obavezna"),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const { login, loading, error, clearError } = useAuthStore()
  const {
    data: tenantOptions = [],
    isLoading: isTenantOptionsLoading,
    isError: isTenantOptionsError,
    error: tenantOptionsError,
  } = useTenantLoginOptionsQuery()
  const [showPassword, setShowPassword] = useState(false)
  const [agencyOpen, setAgencyOpen] = useState(false)
  const [agencySearchQuery, setAgencySearchQuery] = useState("")

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      tenantSlug: "",
      email: "",
      password: "",
    },
  })

  const selectedTenantSlug = watch("tenantSlug")
  const selectedTenant = tenantOptions.find((tenant) => tenant.slug === selectedTenantSlug)

  const filteredTenantOptions = tenantOptions.filter((tenant) => {
    const query = agencySearchQuery.toLowerCase()
    return tenant.name.toLowerCase().includes(query) || tenant.slug.toLowerCase().includes(query)
  })

  const onSubmit = async (data: LoginFormData) => {
    try {
      clearError()
      await login(data.email, data.password, data.tenantSlug)
      toast.success("Uspešno ste se prijavili!")
      router.push("/dashboard")
    } catch (err) {
      toast.error("Greška pri prijavljivanju. Molimo pokušajte ponovo.")
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-12 items-center justify-center">
            <Image
              src="/logo.jpg"
              alt="SVR logo"
              width={120}
              height={40}
              className="h-10 w-auto"
              priority
            />
          </div>
          <CardTitle className="text-2xl font-bold">Sistem za upravljanje i rezervacije</CardTitle>
          <CardDescription>Prijavite se na svoj nalog</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {isTenantOptionsError && (
              <Alert variant="destructive">
                <AlertDescription>
                  {getApiErrorMessage(
                    tenantOptionsError,
                    "Ne možemo da učitamo listu agencija. Pokušajte ponovo."
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="agency">Agencija</Label>
              <input type="hidden" {...register("tenantSlug")} />
              <Popover open={agencyOpen} onOpenChange={setAgencyOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="agency"
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={agencyOpen}
                    disabled={loading || isTenantOptionsLoading}
                    className={cn(
                      "w-full justify-between font-normal",
                      !selectedTenant && "text-muted-foreground",
                      errors.tenantSlug && "border-danger"
                    )}
                  >
                    {isTenantOptionsLoading
                      ? "Učitavanje agencija..."
                      : selectedTenant?.name || "Izaberite agenciju"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Pretražite agenciju..."
                      value={agencySearchQuery}
                      onValueChange={setAgencySearchQuery}
                    />
                    <CommandList>
                      <CommandEmpty>Nema rezultata za unetu pretragu.</CommandEmpty>
                      <CommandGroup>
                        {filteredTenantOptions.map((tenant: PlatformTenantLoginOption) => (
                          <CommandItem
                            key={tenant.slug}
                            value={`${tenant.name} ${tenant.slug}`}
                            onSelect={() => {
                              setValue("tenantSlug", tenant.slug, {
                                shouldDirty: true,
                                shouldTouch: true,
                                shouldValidate: true,
                              })
                              setAgencyOpen(false)
                              setAgencySearchQuery("")
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedTenantSlug === tenant.slug ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span>{tenant.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {errors.tenantSlug && (
                <p className="text-sm text-danger">{errors.tenantSlug.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                  placeholder="Unesite username ili email"
                {...register("email")}
                disabled={loading}
                className={errors.email ? "border-danger" : ""}
              />
              {errors.email && (
                <p className="text-sm text-danger">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Lozinka</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Unesite lozinku"
                  {...register("password")}
                  disabled={loading}
                  className={errors.password ? "border-danger" : ""}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-danger">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              <LogIn className="mr-2 h-4 w-4" />
              {loading ? "Prijavljivanje..." : "Prijavi se"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}










