"use client"

import Link from "next/link"
import { ShieldCheck, Settings as SettingsIcon, ShieldAlert, Upload } from "lucide-react"
import { Layout } from "@/components/layout/Layout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Upload className="h-4 w-4 text-primary" />
                  Uvoz rezervacija iz CSV-a
                </CardTitle>
                <CardDescription>
                  Ucitajte CSV datoteku, proverite prepoznate podatke i masovno uvezite
                  rezervacije i putnike.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/reservations/import">
                    <Upload className="mr-2 h-4 w-4" />
                    Otvori uvoz CSV-a
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* One page for every check. Four of these used to be their own card
                here, each with its own "Proveri" button; at sixteen provera that
                does not fit on a screen, let alone in a head. */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Ispravnost podataka
                </CardTitle>
                <CardDescription>
                  Izgubljene rezervacije, dupla sedista, rute i rasporedi koji se razilaze —
                  sve provere na jednom mestu, sa istorijom i popravkama tamo gde su bezbedne.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/settings/data-integrity">
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Otvori provere podataka
                  </Link>
                </Button>
              </CardContent>
            </Card>
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
