"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SuperadminPageHeader, statusBadge } from "@/components/superadmin/SuperadminShared"
import { useAuthStore } from "@/stores/authStore"
import { Languages, ShieldCheck, User } from "lucide-react"

export default function SuperadminSettingsPage() {
  const { user } = useAuthStore()

  return (
    <div className="space-y-6">
      <SuperadminPageHeader
        eyebrow="Podešavanja"
        title="Podešavanja superadmina"
        subtitle="Podaci o superadmin nalogu i osnovna podešavanja radnog okruženja."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/80 bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-primary" />
              Moj nalog
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">Korisničko ime</p>
              <p className="font-medium">{user?.username ?? "Nije dostupno"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium">{user?.email ?? "Nije dostupno"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Rola</p>
              <div className="mt-1">{statusBadge(user?.role ?? "SUPERADMIN")}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Bezbednost
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">Promena lozinke i poslednja prijava će biti dostupni kada dodamo profil/security API.</p>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="font-medium">Preporuka</p>
              <p className="text-muted-foreground">Koristite zasebne superadmin naloge i ne delite seed kredencijale van lokalnog okruženja.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Languages className="h-4 w-4 text-primary" />
              Radno okruženje
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">Jezik interfejsa</p>
              <p className="font-medium">Srpski latinica</p>
            </div>
            <div>
              <p className="text-muted-foreground">Vremenska zona</p>
              <p className="font-medium">Europe/Belgrade</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
