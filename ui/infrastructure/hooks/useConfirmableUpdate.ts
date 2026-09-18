"use client"

import { useState } from "react"
import type { WouldBreakReservationsDto } from "@/infrastructure/generated/model"
import { ChangeNeedsConfirmationError } from "@/infrastructure/utils/breaking-change"

/**
 * The two-step an update takes when the server refuses it.
 *
 * Every guarded screen was doing the same three things: rethrow so the form
 * stays open on what was typed, hold the refused variables until somebody
 * answers, and send them back with the confirmation. Four copies had already
 * drifted on what to close afterwards, which is the sort of difference nobody
 * notices until one screen leaves a modal open over a change that did land.
 */
interface ConfirmableUpdate<TVariables> {
  update: (
    variables: TVariables & { confirmBreakingChange?: boolean }
  ) => Promise<unknown>
  /** Run after a confirmed update lands — usually closing the form. */
  onConfirmed?: () => void
}

export function useConfirmableUpdate<TVariables extends object>({
  update,
  onConfirmed,
}: ConfirmableUpdate<TVariables>) {
  const [pending, setPending] = useState<{
    variables: TVariables
    confirmation: WouldBreakReservationsDto
    partiallyApplied: boolean
  } | null>(null)

  const run = async (variables: TVariables) => {
    try {
      await update(variables)
    } catch (error) {
      if (error instanceof ChangeNeedsConfirmationError) {
        setPending({
          variables,
          confirmation: error.confirmation,
          partiallyApplied: error.partiallyApplied,
        })
      }

      // Rethrown either way, so the form stays open on the values that were
      // typed rather than closing on a change that was never written.
      throw error
    }
  }

  const confirm = async () => {
    if (!pending) {
      return
    }

    try {
      await update({ ...pending.variables, confirmBreakingChange: true })
      setPending(null)
      onConfirmed?.()
    } catch {
      // The mutation already reported it; the dialog stays up to be retried.
    }
  }

  return {
    run,
    /** Spread onto `ConfirmBreakingChangeDialog`, which needs only `loading`. */
    dialogProps: {
      open: pending !== null,
      onOpenChange: (open: boolean) => {
        if (!open) {
          setPending(null)
        }
      },
      confirmation: pending?.confirmation ?? null,
      partiallyApplied: pending?.partiallyApplied ?? false,
      onConfirm: confirm,
    },
  }
}
