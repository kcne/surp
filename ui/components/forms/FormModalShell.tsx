"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ReactNode } from "react"

interface FormModalShellProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  contentClassName?: string
  children: ReactNode
}

export function FormModalShell({
  open,
  onOpenChange,
  title,
  description,
  contentClassName,
  children,
}: FormModalShellProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={contentClassName}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
