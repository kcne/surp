"use client"

import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Wrench } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { useScheduleDriftQuery } from "@/infrastructure/hooks/queries/useScheduleDriftQuery"
import { useRealignSchedulesMutation } from "@/infrastructure/hooks/mutations/useMaintenanceMutations"

const DAY_LABELS = ["Nedelja", "Ponedeljak", "Utorak", "Sreda", "Cetvrtak", "Petak", "Subota"]

export function ScheduleDriftCard() {
  const driftQuery = useScheduleDriftQuery()
  const realignMutation = useRealignSchedulesMutation()

  const report = driftQuery.data
  const hasDrift = (report?.driftedScheduleCount ?? 0) > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wrench className="h-4 w-4 text-primary" />
          Rasporedi voznji i rute linija
        </CardTitle>
        <CardDescription>
          Kada se stanica doda ili ukloni sa linije, rasporedi voznji napravljeni ranije i dalje
          drze staru listu stanica. Takva voznja ne moze da se izmeni dok se raspored ne uskladi.
          Ovde proveravate i ispravljate takve rasporede. Vremena postojecih stanica se cuvaju, a
          nove stanice dobijaju procenjeno vreme — 15 minuta po stanici, ili ravnomerno
          raspodeljeno izmedju dva poznata vremena. Procene su polazna tacka, proverite ih u
          Rasporedu.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => driftQuery.refetch()}
            disabled={driftQuery.isFetching || realignMutation.isPending}
          >
            {driftQuery.isFetching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Proveri
          </Button>

          <Button
            type="button"
            onClick={() => realignMutation.mutate()}
            disabled={!hasDrift || driftQuery.isFetching || realignMutation.isPending}
          >
            {realignMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uskladjujem...
              </>
            ) : (
              `Uskladi ${report?.driftedScheduleCount ?? 0} rasporeda`
            )}
          </Button>

          {report ? (
            <span className="text-sm text-muted-foreground">
              Provereno {report.scannedScheduleCount} rasporeda
            </span>
          ) : null}
        </div>

        {driftQuery.isError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Provera nije uspela</AlertTitle>
            <AlertDescription>
              {driftQuery.error instanceof Error
                ? driftQuery.error.message
                : "Neuspesna provera rasporeda"}
            </AlertDescription>
          </Alert>
        ) : null}

        {report && !hasDrift && !driftQuery.isFetching ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Svi rasporedi su uskladjeni sa rutama linija</AlertTitle>
            <AlertDescription>Nema nista za ispravku.</AlertDescription>
          </Alert>
        ) : null}

        {hasDrift ? (
          <>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>
                {report?.driftedScheduleCount} rasporeda na {report?.affectedRideCount} voznji nije
                uskladjeno
              </AlertTitle>
              <AlertDescription>
                Ove voznje trenutno ne mogu da se izmene dok se rasporedi ne usklade.
              </AlertDescription>
            </Alert>

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Voznja</TableHead>
                    <TableHead>Linija</TableHead>
                    <TableHead>Dan</TableHead>
                    <TableHead>Stanice</TableHead>
                    <TableHead>Razlika</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report?.items.map((item) => (
                    <TableRow key={`${item.rideId}-${item.dayOfWeek}`}>
                      <TableCell className="font-medium">{item.rideName}</TableCell>
                      <TableCell className="text-muted-foreground">{item.lineName}</TableCell>
                      <TableCell>{DAY_LABELS[item.dayOfWeek] ?? item.dayOfWeek}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {item.scheduleStationCount} / {item.routeStationCount}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {item.addedStationNames.map((name) => (
                            <Badge key={`add-${name}`} variant="secondary">
                              + {name}
                            </Badge>
                          ))}
                          {item.removedStationNames.map((name) => (
                            <Badge key={`remove-${name}`} variant="destructive">
                              − {name}
                            </Badge>
                          ))}
                          {item.reorderedStationNames.map((name) => (
                            <Badge key={`moved-${name}`} variant="outline">
                              ↕ {name}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : null}

        {realignMutation.data && realignMutation.data.estimatedTimeCount > 0 ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              {realignMutation.data.estimatedTimeCount} vremena je procenjeno
            </AlertTitle>
            <AlertDescription>
              Procene su izracunate iz susednih stanica, nisu stvarni red voznje. Otvorite Raspored
              i proverite ih.
            </AlertDescription>
          </Alert>
        ) : null}

        {realignMutation.data && realignMutation.data.reorderedScheduleCount > 0 ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              {realignMutation.data.reorderedScheduleCount} rasporeda ima stanice kojima je
              promenjen redosled
            </AlertTitle>
            <AlertDescription>
              Vremena tih stanica su zadrzana takva kakva su, pa sada mogu da idu unazad (na primer
              08:00, 11:00, 09:00). Ovo se ne moze proceniti — otvorite Raspored i unesite tacna
              vremena.
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  )
}
