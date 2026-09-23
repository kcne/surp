"use client"

import { useState } from "react"
import type { WouldBreakReservationsDto } from "@/infrastructure/generated/model"
import { ChangeNeedsConfirmationError } from "@/infrastructure/utils/breaking-change"

/**
 * What the agency has answered so far, by step.
 *
 * An edit can raise several invariant questions for the same request. Keep the
 * invariant with each answer so overriding one does not discard a repair the
 * agency chose for another. The token is what the answer actually sends: the
 * server's name for the exact set of reservations the agency was shown, so an
 * answer never stretches to cover passengers booked after the question.
 */
export interface BreakingChangeAnswer {
  step: string
  invariant: string
  token: string
}

export interface BreakingChangeAnswers {
  confirmed: BreakingChangeAnswer[]
  repaired: BreakingChangeAnswer[]
}

const NO_ANSWERS: BreakingChangeAnswers = { confirmed: [], repaired: [] }

/**
 * The request fields that carry the answers, for one step of an edit or, with
 * no step, for an edit that is a single request.
 */
export function answerTokens(
  answers: BreakingChangeAnswers | undefined,
  step?: string
): { confirmationTokens: string[]; repairTokens: string[] } {
  const forStep = (entries: BreakingChangeAnswer[] = []) =>
    entries.filter((answer) => step === undefined || answer.step === step).map((answer) => answer.token)

  return {
    confirmationTokens: forStep(answers?.confirmed),
    repairTokens: forStep(answers?.repaired),
  }
}

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
    changedSinceAnswered: boolean
    repairFailed: boolean
  } | null>(null)

  const attempt = async (
    variables: TVariables,
    answers: BreakingChangeAnswers,
    previouslyApplied = false
  ) => {
    try {
      await update(variables, answers)
      setPending(null)
    } catch (error) {
      if (error instanceof ChangeNeedsConfirmationError) {
        const { invariant, confirmationToken, repairable } = error.confirmation
        const answerTo = (entries: BreakingChangeAnswer[]) =>
          entries.find((answer) => answer.step === error.step && answer.invariant === invariant)
        const confirmedBefore = answerTo(answers.confirmed)
        const repairedBefore = answerTo(answers.repaired)
        const previous = confirmedBefore ?? repairedBefore

        setPending({
          variables,
          answers,
          step: error.step,
          confirmation: error.confirmation,
          partiallyApplied: previouslyApplied || error.partiallyApplied,
          // A new token for a question already answered means the affected
          // reservations changed in between. The same token means they did not.
          changedSinceAnswered: previous !== undefined && previous.token !== confirmationToken,
          // The same set, refused after asking for a repair: the repair could
          // not settle every one, and it rolled back with the rest of the edit.
          repairFailed:
            repairedBefore !== undefined &&
            repairedBefore.token === confirmationToken &&
            !repairable,
        })
      }

      throw error
    }
  }

  /**
   * Replace the answer to this invariant only. A later refusal for another
   * invariant on the same request keeps its earlier repair or override.
   */
  const answering = (
    answers: BreakingChangeAnswers,
    step: string,
    confirmation: WouldBreakReservationsDto,
    as: keyof BreakingChangeAnswers
  ): BreakingChangeAnswers => {
    const { invariant, confirmationToken: token } = confirmation
    const without = (entries: BreakingChangeAnswer[]) =>
      entries.filter((answered) => answered.step !== step || answered.invariant !== invariant)
    const answer = { step, invariant, token }

    return as === "confirmed"
      ? { confirmed: [...without(answers.confirmed), answer], repaired: without(answers.repaired) }
      : { confirmed: without(answers.confirmed), repaired: [...without(answers.repaired), answer] }
  }

  const answer = (as: keyof BreakingChangeAnswers) => async () => {
    if (!pending) {
      return
    }

    try {
      await attempt(
        pending.variables,
        answering(pending.answers, pending.step, pending.confirmation, as),
        pending.partiallyApplied
      )
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
      changedSinceAnswered: pending?.changedSinceAnswered ?? false,
      repairFailed: pending?.repairFailed ?? false,
      onConfirm: answer("confirmed"),
      onRepair: answer("repaired"),
    },
  }
}
