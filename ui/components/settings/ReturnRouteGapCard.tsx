"use client"

import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, TicketX } from "lucide-react"
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
import { useReturnRouteGapsQuery } from "@/infrastructure/hooks/queries/useReturnRouteGapsQuery"

export function ReturnRouteGapCard() {
  const gapsQuery = useReturnRouteGapsQuery()
  const report = gapsQuery.data
  const hasGaps = (report?.gapCount ?? 0) > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TicketX className="h-4 w-4 text-primary" />
          Povratne karte i krajnje stanice
        </CardTitle>
        <CardDescription>
          Povratna karta uzima stanice polazne voznje i trazi ih na suprotnom smeru. Ako jedan smer
          zavrsava na stanici koju drugi smer uopste ne dodiruje, povratna karta preko te stanice
          nije moguca — pri rezervaciji se javlja &quot;Povratna voznja ne podrzava izabrane
          stanice&quot;, sto ne ukazuje na pravi uzrok.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => gapsQuery.refetch()}
          disabled={gapsQuery.isFetching}
        >
          {gapsQuery.isFetching ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Proveri
        </Button>

        {gapsQuery.isError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Provera nije uspela</AlertTitle>
            <AlertDescription>
              {gapsQuery.error instanceof Error
                ? gapsQuery.error.message
                : "Neuspesna provera povratnih ruta"}
            </AlertDescription>
          </Alert>
        ) : null}

        {report && !hasGaps && !gapsQuery.isFetching ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Svi smerovi dodiruju krajnje stanice onog drugog</AlertTitle>
            <AlertDescription>Povratne karte rade na svim linijama.</AlertDescription>
          </Alert>
        ) : null}

        {hasGaps ? (
          <>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Linija</TableHead>
                    <TableHead>Stanica koja nedostaje na suprotnom smeru</TableHead>
                    <TableHead>Suprotni smer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report?.items.map((item) => (
                    <TableRow key={`${item.pairKey}-${item.lineName}`}>
                      <TableCell className="font-medium">{item.lineName}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {item.unreachableStationNames.map((name) => (
                            <Badge key={name} variant="destructive">
                              {name}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.oppositeLineName}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Ovo se ne ispravlja automatski</AlertTitle>
              <AlertDescription>
                Dodavanje krajnje stanice na suprotnu rutu znaci odluku gde tacno na toj ruti
                autobus staje, a to se iz podataka ne moze zakljuciti. Cesto su i te dve stanice
                isto fizicko mesto upisano dvaput — u tom slucaju ih spojite u jednu. U suprotnom
                dodajte stanicu na suprotnu rutu rucno, na odgovarajuce mesto u redosledu.
              </AlertDescription>
            </Alert>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
