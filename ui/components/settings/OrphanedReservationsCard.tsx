"use client"

import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, UserRoundSearch } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useOrphanedReservationsQuery } from "@/infrastructure/hooks/queries/useOrphanedReservationsQuery"
import { useRepairOrphanedReservationsMutation } from "@/infrastructure/hooks/mutations/useMaintenanceMutations"

const REASON_LABELS: Record<string, string> = {
  DEPARTURE_TIME_MOVED: "Vreme polaska pomereno",
  AMBIGUOUS_INSTANCE: "Vise polazaka tog dana",
  NO_INSTANCE: "Voznja tog dana ne postoji",
  RIDE_NOT_ACTIVE: "Voznja nije aktivna",
}

const REASON_HELP: Record<string, string> = {
  AMBIGUOUS_INSTANCE:
    "Tog dana voznja ima vise polazaka, pa se iz podataka ne vidi na koji je putnik rezervisao. Otvorite rezervaciju i izaberite polazak rucno.",
  NO_INSTANCE:
    "Tog dana voznja uopste ne saobraca — dan je van perioda ponavljanja, nema raspored za taj dan u nedelji, upisan je izuzetak da se ne vozi, ili prva odnosno poslednja stanica nema vreme. Sredite raspored u Voznjama, pa ponovite proveru.",
  RIDE_NOT_ACTIVE:
    "Voznja je u statusu Nacrt ili Neaktivna, pa se ne prikazuje nigde. Vratite je u Aktivna, pa ponovite proveru.",
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-")
  return `${day}.${month}.${year}.`
}

export function OrphanedReservationsCard() {
  const orphansQuery = useOrphanedReservationsQuery()
  const repairMutation = useRepairOrphanedReservationsMutation()

  const report = orphansQuery.data
  const hasOrphans = (report?.orphanedCount ?? 0) > 0
  const repairableCount = report?.repairableCount ?? 0
  const seatChangeCount = report?.seatChangeCount ?? 0
  const manualCount = (report?.orphanedCount ?? 0) - repairableCount
  const isBusy = orphansQuery.isFetching || repairMutation.isPending

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserRoundSearch className="h-4 w-4 text-primary" />
          Izgubljene rezervacije
        </CardTitle>
        <CardDescription>
          Rezervacija se u aplikaciji vidi samo preko polaska na koji je vezana, a veza ide preko
          vremena polaska. Kada se stanice na liniji prerasporede ili se doda nova prva stanica,
          polazak dobija novo vreme — a rezervacije napravljene ranije i dalje nose staro. One
          ostaju u bazi, ali nestaju sa spiskova putnika i i dalje drze sediste koje niko ne vidi.
          Ovde se traze takve rezervacije za narednih 30 dana i vracaju na polazak koji tog dana
          stvarno saobraca.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => orphansQuery.refetch()}
            disabled={isBusy}
          >
            {orphansQuery.isFetching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Proveri
          </Button>

          {repairableCount > 0 ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" disabled={isBusy}>
                  {repairMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Vrati u sistem ({repairableCount})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Vratiti {repairableCount} rezervacija u sistem?
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-2">
                      <p>
                        Svaka se prebacuje na polazak koji tog dana stvarno saobraca. Sama
                        rezervacija — putnik, datum, stanice — ostaje nepromenjena.
                      </p>
                      {seatChangeCount > 0 ? (
                        <p>
                          <strong>{seatChangeCount}</strong> od njih dobija novo sediste, jer je
                          staro u medjuvremenu prodato drugom putniku dok je ova rezervacija bila
                          nevidljiva. Ta sedista su ispod obelezena, pozovite te putnike.
                        </p>
                      ) : null}
                      {manualCount > 0 ? (
                        <p>
                          Preostalih <strong>{manualCount}</strong> se ne dira — za njih se iz
                          podataka ne vidi na koji polazak spadaju.
                        </p>
                      ) : null}
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Odustani</AlertDialogCancel>
                  <AlertDialogAction onClick={() => repairMutation.mutate()}>
                    Vrati u sistem
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>

        {orphansQuery.isError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Provera nije uspela</AlertTitle>
            <AlertDescription>
              {orphansQuery.error instanceof Error
                ? orphansQuery.error.message
                : "Neuspesna provera izgubljenih rezervacija"}
            </AlertDescription>
          </Alert>
        ) : null}

        {report && !hasOrphans && !orphansQuery.isFetching ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Nijedna rezervacija nije izgubljena</AlertTitle>
            <AlertDescription>
              Provereno {report.scannedReservationCount} aktivnih rezervacija od{" "}
              {formatDate(report.windowStartDate)} do {formatDate(report.windowEndDate)}. Sve se
              vide na svom polasku.
            </AlertDescription>
          </Alert>
        ) : null}

        {hasOrphans && report ? (
          <>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>
                {report.orphanedCount} od {report.scannedReservationCount} rezervacija se ne vidi
                nigde u aplikaciji
              </AlertTitle>
              <AlertDescription>
                Putovanja od {formatDate(report.windowStartDate)} do{" "}
                {formatDate(report.windowEndDate)}. Nisu obrisane — samo su vezane za vreme
                polaska koje vise ne postoji.
              </AlertDescription>
            </Alert>

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Putnik</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Linija</TableHead>
                    <TableHead>Relacija</TableHead>
                    <TableHead>Polazak</TableHead>
                    <TableHead>Sediste</TableHead>
                    <TableHead>Razlog</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.items.map((item) => (
                    <TableRow key={item.reservationId}>
                      <TableCell className="font-medium">
                        <div>{item.passengerName}</div>
                        <div className="text-xs text-muted-foreground">{item.passengerPhone}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(item.travelDate)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.lineName}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.departureStationName} &rarr; {item.arrivalStationName}
                        {item.offRouteStationNames.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {item.offRouteStationNames.map((name) => (
                              <Badge key={name} variant="destructive">
                                {name} nije na ruti
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {item.targetDepartureTime ? (
                          <span>
                            <span className="text-muted-foreground line-through">
                              {item.currentDepartureTime}
                            </span>{" "}
                            &rarr; <strong>{item.targetDepartureTime}</strong>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            {item.currentDepartureTime}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {item.targetSeatNumber === null ? (
                          <Badge variant="destructive">nema slobodnog</Badge>
                        ) : item.targetSeatNumber === item.seatNumber ? (
                          <span>{item.seatNumber}</span>
                        ) : (
                          <Badge variant="destructive">
                            {item.seatNumber} &rarr; {item.targetSeatNumber}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.canRepair ? "secondary" : "destructive"}>
                          {REASON_LABELS[item.reason] ?? item.reason}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {seatChangeCount > 0 ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{seatChangeCount} putnika menja sediste</AlertTitle>
                <AlertDescription>
                  Dok su ove rezervacije bile nevidljive, njihova sedista su izgledala slobodno i
                  prodata su drugim putnicima. Vracanjem u sistem dobijaju prvo slobodno sediste na
                  tom polasku — pozovite ih pre polaska.
                </AlertDescription>
              </Alert>
            ) : null}

            {Array.from(
              new Set(
                report.items
                  .filter((item) => !item.canRepair)
                  .map((item) => item.reason)
              )
            ).map((reason) => (
              <Alert key={reason}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>
                  {REASON_LABELS[reason] ?? reason} — ovo se ne ispravlja automatski
                </AlertTitle>
                <AlertDescription>{REASON_HELP[reason]}</AlertDescription>
              </Alert>
            ))}
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
