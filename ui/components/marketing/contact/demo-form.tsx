"use client"

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

  return (
    <form action={formAction} className="mk-surface rounded-[2rem] p-6 shadow-mk-lg md:p-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mk-indigo-600)]">
          Demo zahtev
        </p>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.025em] text-[color:var(--mk-navy-900)]">
          Recite nam kako radi vasa agencija.
        </h2>
        <p className="mt-3 text-sm leading-6 text-[color:var(--mk-text-muted)]">
          Odgovor stize sa predlogom termina i pitanjima za pripremu demo-a.
        </p>
      </div>

      <div className="mt-8 grid gap-5">
        <TextField label="Ime i prezime" name="name" autoComplete="name" required />
        <TextField label="Email" name="email" type="email" autoComplete="email" required />
        <TextField label="Naziv agencije" name="agencyName" autoComplete="organization" required />
        <TextField label="Telefon" name="phone" type="tel" autoComplete="tel" />

        <div>
          <label htmlFor="departuresPerDay" className="text-sm font-semibold text-[color:var(--mk-navy-900)]">
            Broj polazaka dnevno
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
            Gruba procena je dovoljna za prvi razgovor.
          </p>
        </div>

        <div>
          <label htmlFor="message" className="text-sm font-semibold text-[color:var(--mk-navy-900)]">
            Sta zelite da resite prvo?
          </label>
          <textarea
            id="message"
            name="message"
            rows={5}
            maxLength={1200}
            className="mt-2 w-full rounded-2xl border border-[color:var(--mk-border)] bg-white px-4 py-3 text-sm text-[color:var(--mk-navy-900)] outline-none transition focus:border-[color:var(--mk-indigo-600)] focus:ring-4 focus:ring-[color:var(--mk-indigo-100)]"
            placeholder="Npr. online rezervacije, bolji pregled polazaka, migracija iz Excel-a..."
          />
        </div>

        <div className="hidden" aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input id="website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
      </div>

      {state.message ? (
        <p
          className={`mt-5 rounded-2xl px-4 py-3 text-sm ${
            state.status === "success"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
          role="status"
        >
          {state.status === "success" ? <CheckCircle2 className="mr-2 inline h-4 w-4" /> : null}
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
      {pending ? "Slanje..." : "Posaljite zahtev"}
      <Send className="h-4 w-4" />
    </button>
  )
}
