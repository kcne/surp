"use client"

import { useCallback, useRef, useState } from "react"
import { FileSpreadsheet, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ImportDropzoneProps {
  fileName?: string
  disabled?: boolean
  onFileSelected: (file: File) => void
}

function isCsvFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv"
}

export function ImportDropzone({ fileName, disabled, onFileSelected }: ImportDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [rejectedName, setRejectedName] = useState<string | null>(null)

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) {
        return
      }

      if (!isCsvFile(file)) {
        setRejectedName(file.name)
        return
      }

      setRejectedName(null)
      onFileSelected(file)
    },
    [onFileSelected]
  )

  return (
    <div>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (!disabled && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) {
            setIsDragging(true)
          }
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          if (!disabled) {
            handleFile(event.dataTransfer.files?.[0])
          }
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors",
          disabled
            ? "cursor-not-allowed border-muted bg-muted/30 opacity-60"
            : "cursor-pointer border-muted-foreground/30 hover:border-primary/60 hover:bg-accent/40",
          isDragging && "border-primary bg-accent/60"
        )}
      >
        {fileName ? (
          <FileSpreadsheet className="h-8 w-8 text-primary" />
        ) : (
          <Upload className="h-8 w-8 text-muted-foreground" />
        )}

        <div className="space-y-1">
          <p className="font-medium">
            {fileName ?? "Prevucite CSV ovde ili kliknite da izaberete"}
          </p>
          <p className="text-sm text-muted-foreground">
            Ocekivane kolone: Ime i prezime, Polazi iz, Dolazi u, Datum odlaska, Telefon, Datum
            povratka
          </p>
        </div>

        <Button type="button" variant="outline" size="sm" disabled={disabled}>
          Izaberi datoteku
        </Button>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => {
            handleFile(event.target.files?.[0])
            event.target.value = ""
          }}
        />
      </div>

      {rejectedName ? (
        <p className="mt-2 text-sm text-destructive">
          {rejectedName} nije CSV datoteka.
        </p>
      ) : null}
    </div>
  )
}
