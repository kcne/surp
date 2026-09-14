"use client"

import { useEffect, useState } from "react"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

export type ExportFormat = "xlsx" | "pdf"
export type ExportNumbering = "sequential" | "seat"

interface ExportPassengersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultFileName: string
  onExport: (options: {
    fileName: string
    format: ExportFormat
    numbering: ExportNumbering
  }) => Promise<void> | void
}

export function ExportPassengersDialog({
  open,
  onOpenChange,
  defaultFileName,
  onExport,
}: ExportPassengersDialogProps) {
  const [fileName, setFileName] = useState(defaultFileName)
  const [format, setFormat] = useState<ExportFormat>("xlsx")
  const [numbering, setNumbering] = useState<ExportNumbering>("sequential")
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    if (open) {
      setFileName(defaultFileName)
      setFormat("xlsx")
      setNumbering("sequential")
    }
  }, [open, defaultFileName])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = fileName.trim() || defaultFileName
    setIsExporting(true)
    try {
      await onExport({ fileName: trimmed, format, numbering })
      onOpenChange(false)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Izvoz liste putnika</DialogTitle>
            <DialogDescription>
              Izaberite naziv fajla i format u kojem želite da izvezete listu putnika.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="export-file-name">Ime fajla</Label>
            <Input
              id="export-file-name"
              value={fileName}
              onChange={(event) => setFileName(event.target.value)}
              placeholder={defaultFileName}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Ekstenzija (.{format}) će biti dodata automatski.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Format</Label>
            <RadioGroup
              value={format}
              onValueChange={(value) => setFormat(value as ExportFormat)}
              className="grid grid-cols-2 gap-2"
            >
              <Label
                htmlFor="export-format-xlsx"
                className="flex cursor-pointer items-center gap-2 rounded-md border p-3 hover:bg-muted/50"
              >
                <RadioGroupItem value="xlsx" id="export-format-xlsx" />
                <span>Excel (.xlsx)</span>
              </Label>
              <Label
                htmlFor="export-format-pdf"
                className="flex cursor-pointer items-center gap-2 rounded-md border p-3 hover:bg-muted/50"
              >
                <RadioGroupItem value="pdf" id="export-format-pdf" />
                <span>PDF (.pdf)</span>
              </Label>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Numeracija</Label>
            <RadioGroup
              value={numbering}
              onValueChange={(value) => setNumbering(value as ExportNumbering)}
              className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            >
              <Label
                htmlFor="export-numbering-sequential"
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border p-3 hover:bg-muted/50"
              >
                <RadioGroupItem value="sequential" id="export-numbering-sequential" />
                <span>Po redu (1, 2, 3…)</span>
              </Label>
              <Label
                htmlFor="export-numbering-seat"
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border p-3 hover:bg-muted/50"
              >
                <RadioGroupItem value="seat" id="export-numbering-seat" />
                <span>Po sedištima</span>
              </Label>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              Kolona „Sedište” je uvek prikazana.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isExporting}
            >
              Otkaži
            </Button>
            <Button type="submit" disabled={isExporting}>
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? "Izvozim..." : "Izvezi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
