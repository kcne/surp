"use client"

import { AlertTriangle, ArrowLeftRight, CheckCircle2, Loader2, RefreshCw } from "lucide-react"
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
import { usePairDriftQuery } from "@/infrastructure/hooks/queries/usePairDriftQuery"
import { useSyncLinePairsMutation } from "@/infrastructure/hooks/mutations/useMaintenanceMutations"
import type { PairDriftLineDto } from "@/infrastructure/generated/model"

function DirectionCell({ line }: { line: PairDriftLineDto }) {
  return (
    <div className="space-y-1">
      <div className="font-medium">{line.name}</div>
      <div className="text-xs text-muted-foreground">{line.stopCount} medjustanica</div>
      {line.missingStationNames.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {line.missingStationNames.map((name) => (
            <Badge key={name} variant="destructive">
              nedostaje {name}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function LinePairDriftCard() {
  const driftQuery = usePairDriftQuery()
  const syncMutation = useSyncLinePairsMutation()

  const report = driftQuery.data
  const syncableCount = report?.items.filter((item) => item.canAutoSync).length ?? 0
  const conflictCount = (report?.driftedPairCount ?? 0) - syncableCount

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ArrowLeftRight className="h-4 w-4 text-primary" />
          Smerovi uparenih linija
        </CardTitle>
        <CardDescription>
          Uparena linija opisuje istu rutu u oba smera, pa oba smera treba da imaju iste
          medjustanice obrnutim redosledom. Polazna i dolazna stanica svakog smera ostaju
          nepromenjene — one se sme razlikovati. Parovi u kojima se smerovi stvarno razilaze
          preskacu se umesto da se pogadja koji je tacan.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => driftQuery.refetch()}
            disabled={driftQuery.isFetching || syncMutation.isPending}
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
            onClick={() => syncMutation.mutate()}
            disabled={syncableCount === 0 || driftQuery.isFetching || syncMutation.isPending}
          >
            {syncMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uskladjujem...
              </>
            ) : (
              `Uskladi ${syncableCount} parova`
            )}
          </Button>

          {report ? (
            <span className="text-sm text-muted-foreground">
              Provereno {report.scannedPairCount} parova
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
                : "Neuspesna provera smerova"}
            </AlertDescription>
          </Alert>
        ) : null}

        {report && report.driftedPairCount === 0 && !driftQuery.isFetching ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Svi smerovi imaju iste medjustanice</AlertTitle>
            <AlertDescription>Nema nista za uskladjivanje.</AlertDescription>
          </Alert>
        ) : null}

        {report && report.driftedPairCount > 0 ? (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Polazni smer</TableHead>
                  <TableHead>Povratni smer</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.items.map((item) => (
                  <TableRow key={item.pairKey} className="align-top">
                    <TableCell>
                      <DirectionCell line={item.outbound} />
                    </TableCell>
                    <TableCell>
                      <DirectionCell line={item.inbound} />
                    </TableCell>
                    <TableCell>
                      {item.canAutoSync ? (
                        <Badge variant="secondary">Moze automatski</Badge>
                      ) : (
                        <div className="space-y-1">
                          <Badge variant="destructive">Rucno</Badge>
                          <p className="max-w-xs text-xs text-muted-foreground">
                            {item.conflictReason}
                          </p>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {conflictCount > 0 ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{conflictCount} parova zahteva rucnu izmenu</AlertTitle>
            <AlertDescription>
              Kod njih svaki smer ima stanicu koju drugi nema, ili je redosled razlicit, pa nije
              moguce znati koji je tacan. Otvorite linije i uskladite ih rucno.
            </AlertDescription>
          </Alert>
        ) : null}

        {syncMutation.data && syncMutation.data.realignedScheduleCount > 0 ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              Uskladjeno je i {syncMutation.data.realignedScheduleCount} rasporeda
            </AlertTitle>
            <AlertDescription>
              Promena rute povlaci i rasporede voznji. Nove stanice su dobile procenjena vremena —
              proverite ih u Rasporedu.
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  )
}
