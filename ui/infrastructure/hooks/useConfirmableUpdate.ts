"use client"

import { useState } from "react"
import type { WouldBreakReservationsDto } from "@/infrastructure/generated/model"
import { ChangeNeedsConfirmationError } from "@/infrastructure/utils/breaking-change"

/**
 * What the agency has answered so far, by step.
 *
 * Two lists rather than one, because a refusal has two answers and they are
 * not degrees of the same thing. Confirming writes the change and leaves the
 * breakage for the integrity report; repairing writes it and puts the affected
 * reservations back in order. A step appears in at most one list: answering
 * again replaces the earlier answer rather than adding to it.
 */
export interface BreakingChangeAnswers {
  confirmed: string[]
  repaired: string[]
}

const NO_ANSWERS: BreakingChangeAnswers = { confirmed: [], repaired: [] }

/**
 * The two-step an update takes when the server refuses it.
 *
 * Every guarded screen was doing the same three things: rethrow so the form
 * stays open on what was typed, hold the refused variables until somebody
 * answers, and send them back with the confirmation. Four copies had already
 * drifted on what to close afterwards, which is the sort of difference nobody
 * notices until one screen leaves a modal open over a change that did land.
 *
 * Answers accumulate by step rather than being one flag, because an edit can be
 * several requests and each can be refused for its own reason. Answering the
 * question about the ride must not silently answer an unasked question about an
 * exception, so each refusal comes back as its own dialog.
 */
interface ConfirmableUpdate<TVariables> {
  update: (variables: TVariables, answers: BreakingChangeAnswers) => Promise<unknown>
  /** Run after a confirmed update lands — usually closing the form. */
  onConfirmed?: () => void
}

export function useConfirmableUpdate<TVariables>({
  update,
  onConfirmed,
}: ConfirmableUpdate<TVariables>) {
  const [pending, setPending] = useState<{
    variables: TVariables
    answers: BreakingChangeAnswers
    step: string
    confirmation: WouldBreakReservationsDto
    partiallyApplied: boolean
  } | null>(null)

  const attempt = async (variables: TVariables, answers: BreakingChangeAnswers) => {
    try {
      await update(variables, answers)
      setPending(null)
    } catch (error) {
      if (error instanceof ChangeNeedsConfirmationError) {
        setPending({
          variables,
          answers,
          step: error.step,
          confirmation: error.confirmation,
          partiallyApplied: error.partiallyApplied,
        })
      }

      throw error
    }
  }

  /**
   * Adds this refusal's step to one list and takes it out of the other, so a
   * retry carries every answer given so far, none that was not, and only the
   * latest answer to any one question. Pressing "save anyway" after a repair
   * fell short must not resend the repair that already failed.
   */
  const answering = (
    answers: BreakingChangeAnswers,
    step: string,
    as: keyof BreakingChangeAnswers
  ): BreakingChangeAnswers => {
    const without = (steps: string[]) => steps.filter((answered) => answered !== step)

    return as === "confirmed"
      ? { confirmed: [...without(answers.confirmed), step], repaired: without(answers.repaired) }
      : { confirmed: without(answers.confirmed), repaired: [...without(answers.repaired), step] }
  }

  const answer = (as: keyof BreakingChangeAnswers) => async () => {
    if (!pending) {
      return
    }

    try {
      await attempt(pending.variables, answering(pending.answers, pending.step, as))
      onConfirmed?.()
    } catch {
      // Either the next refusal, now showing in this same dialog, or an
      // ordinary failure the mutation has already reported.
    }
  }

  return {
    // Rethrows, so the form stays open on the values that were typed rather
    // than closing on a change that was never written.
    run: (variables: TVariables) => attempt(variables, NO_ANSWERS),

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
      onConfirm: answer("confirmed"),
      onRepair: answer("repaired"),
    },
  }
}
