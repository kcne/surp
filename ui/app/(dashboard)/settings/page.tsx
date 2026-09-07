"use client"

import { Settings as SettingsIcon, ShieldAlert } from "lucide-react"
import { Layout } from "@/components/layout/Layout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { LinePairDriftCard } from "@/components/settings/LinePairDriftCard"
import { ScheduleDriftCard } from "@/components/settings/ScheduleDriftCard"
import { useAuthStore } from "@/stores/authStore"

export default function SettingsPage() {
  const { user } = useAuthStore()
  const isTenantAdmin = user?.role === "ADMIN"

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <SettingsIcon className="h-6 w-6 text-primary" />
            Podesavanja
          </h1>
          <p className="text-muted-foreground">
            Odrzavanje podataka agencije
          </p>
        </div>

        {isTenantAdmin ? (
          <div className="space-y-6">
            {/* Pair sync first: it changes routes, which is what makes
                schedules drift in the first place. */}
            <LinePairDriftCard />
            <ScheduleDriftCard />
          </div>
        ) : (
          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Potrebne su admin dozvole</AlertTitle>
            <AlertDescription>
              Samo tenant admin korisnici mogu da pokrenu odrzavanje podataka.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </Layout>
  )
}
