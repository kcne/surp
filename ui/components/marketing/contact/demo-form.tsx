"use client"

import { useEffect, useRef } from "react"
import { useFormState, useFormStatus } from "react-dom"
import { CheckCircle2, Send } from "lucide-react"
import {
  type DemoLeadActionState,
  submitDemoLeadAction,
} from "@/app/(marketing)/kontakt/actions"

const initialState: DemoLeadActionState = {
  status: "idle",
  message: "",
}

export function DemoForm() {
  const [state, formAction] = useFormState(submitDemoLeadAction, initialState)
  const successPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (state.status === "success") {
      successPanelRef.current?.focus()
    }
  }, [state.status])

  if (state.status === "success") {
    return (
      <div
        ref={successPanelRef}
        className="mk-surface rounded-[2rem] p-6 text-center shadow-mk-lg outline-none md:p-8"
        role="status"
        aria-live="polite"
        tabIndex={-1}
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/60">
          <CheckCircle2 className="h-9 w-9" aria-hidden="true" />
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mk-indigo-600)]">
          Zahtev je poslat
        </p>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.025em] text-[color:var(--mk-navy-900)]">
          Hvala, javicemo vam se uskoro.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[color:var(--mk-text-muted)]">
          Primili smo vasu poruku i uskoro cemo vam odgovoriti sa predlogom
          narednih koraka.
        </p>
      </div>
    )
  }

  return (
    <form action={formAction} className="mk-surface rounded-[2rem] p-6 shadow-mk-lg md:p-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mk-indigo-600)]">
          Kontakt
        </p>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.025em] text-[color:var(--mk-navy-900)]">
          Recite nam sta zelite da unapredite.
        </h2>
        <p className="mt-3 text-sm leading-6 text-[color:var(--mk-text-muted)]">
          Napisite nam da li zelite bolji pregled rezervacija, online prodaju
          karata, javni sajt agencije ili pomoc oko organizacije rada.
        </p>
      </div>

      <div className="mt-8 grid gap-5">
        <TextField label="Ime i prezime" name="name" autoComplete="name" required />
        <TextField label="Email" name="email" type="email" autoComplete="email" required />
        <TextField label="Naziv agencije" name="agencyName" autoComplete="organization" required />
        <TextField label="Telefon" name="phone" type="tel" autoComplete="tel" />

        <div>
          <label htmlFor="departuresPerDay" className="text-sm font-semibold text-[color:var(--mk-navy-900)]">
            Koliko polazaka imate dnevno?
          </label>
          <select
            id="departuresPerDay"
            name="departuresPerDay"
            required
            className="mt-2 min-h-12 w-full rounded-2xl border border-[color:var(--mk-border)] bg-white px-4 text-sm text-[color:var(--mk-navy-900)] outline-none transition focus:border-[color:var(--mk-indigo-600)] focus:ring-4 focus:ring-[color:var(--mk-indigo-100)]"
            defaultValue=""
          >
            <option value="" disabled>
              Izaberite opseg
            </option>
            <option value="1-5">1-5</option>
            <option value="6-20">6-20</option>
            <option value="21-50">21-50</option>
            <option value="50+">50+</option>
          </select>
          <p className="mt-2 text-xs text-[color:var(--mk-text-subtle)]">
            Dovoljna je okvirna procena.
          </p>
        </div>

        <div>
          <label htmlFor="message" className="text-sm font-semibold text-[color:var(--mk-navy-900)]">
            Sta zelite prvo da sredite?
          </label>
          <textarea
            id="message"
            name="message"
            rows={5}
            maxLength={1200}
            className="mt-2 w-full rounded-2xl border border-[color:var(--mk-border)] bg-white px-4 py-3 text-sm text-[color:var(--mk-navy-900)] outline-none transition focus:border-[color:var(--mk-indigo-600)] focus:ring-4 focus:ring-[color:var(--mk-indigo-100)]"
            placeholder="Npr. online rezervacije, bolji pregled polazaka, manje poziva, prelazak sa tabela..."
          />
        </div>

        <div className="hidden" aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input id="website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
      </div>

      {state.status === "error" && state.message ? (
        <p
          className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700"
          role="status"
        >
          {state.message}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  )
}

function TextField({
  label,
  name,
  type = "text",
  autoComplete,
  required = false,
}: {
  label: string
  name: string
  type?: string
  autoComplete?: string
  required?: boolean
}) {
  return (
    <div>
      <label htmlFor={name} className="text-sm font-semibold text-[color:var(--mk-navy-900)]">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        className="mt-2 min-h-12 w-full rounded-2xl border border-[color:var(--mk-border)] bg-white px-4 text-sm text-[color:var(--mk-navy-900)] outline-none transition focus:border-[color:var(--mk-indigo-600)] focus:ring-4 focus:ring-[color:var(--mk-indigo-100)]"
      />
    </div>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[color:var(--mk-indigo-600)] px-6 py-3 text-sm font-semibold text-white shadow-mk-glow transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mk-indigo-600)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Slanje..." : "Posaljite poruku"}
      <Send className="h-4 w-4" />
    </button>
  )
}
