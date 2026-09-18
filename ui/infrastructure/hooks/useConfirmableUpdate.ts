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
 *
 * Confirmations accumulate by step rather than being one flag, because an edit
 * can be several requests and each can be refused for its own reason. Answering
 * the question about the ride must not silently answer an unasked question
 * about an exception, so each refusal comes back as its own dialog.
 */
interface ConfirmableUpdate<TVariables> {
  update: (variables: TVariables, confirmedSteps: string[]) => Promise<unknown>
  /** Run after a confirmed update lands — usually closing the form. */
  onConfirmed?: () => void
}

export function useConfirmableUpdate<TVariables>({
  update,
  onConfirmed,
}: ConfirmableUpdate<TVariables>) {
  const [pending, setPending] = useState<{
    variables: TVariables
    confirmedSteps: string[]
    confirmation: WouldBreakReservationsDto
    partiallyApplied: boolean
  } | null>(null)

  const attempt = async (variables: TVariables, confirmedSteps: string[]) => {
    try {
      await update(variables, confirmedSteps)
      setPending(null)
    } catch (error) {
      if (error instanceof ChangeNeedsConfirmationError) {
        setPending({
          variables,
          // The refused step joins the ones already answered, so a retry
          // carries every answer given so far and no answer that was not.
          confirmedSteps: [...confirmedSteps, error.step],
          confirmation: error.confirmation,
          partiallyApplied: error.partiallyApplied,
        })
      }

      throw error
    }
  }

  return {
    // Rethrows, so the form stays open on the values that were typed rather
    // than closing on a change that was never written.
    run: (variables: TVariables) => attempt(variables, []),

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
      onConfirm: async () => {
        if (!pending) {
          return
        }

        try {
          await attempt(pending.variables, pending.confirmedSteps)
          onConfirmed?.()
        } catch {
          // Either the next refusal, now showing in this same dialog, or an
          // ordinary failure the mutation has already reported.
        }
      },
    },
  }
}
