"use server"

import { z } from "zod"
import { getApiBaseUrl } from "@/lib/storefront"

export type DemoLeadActionState = {
  status: "idle" | "success" | "error"
  message: string
}

const initialErrorState: DemoLeadActionState = {
  status: "error",
  message: "Zahtev nije poslat. Proverite polja i pokusajte ponovo.",
}

const demoLeadSchema = z.object({
  name: z.string().trim().min(2, "Unesite ime i prezime.").max(120, "Ime i prezime je predugacko."),
  email: z.string().trim().email("Unesite validan email.").max(180, "Email je predugacak."),
  agencyName: z.string().trim().min(2, "Unesite naziv agencije.").max(160, "Naziv agencije je predugacak."),
  phone: z
    .string()
    .trim()
    .max(60, "Telefon je predugacak.")
    .transform((value) => value || undefined),
  departuresPerDay: z.enum(["1-5", "6-20", "21-50", "50+"]),
  message: z
    .string()
    .trim()
    .max(1200, "Poruka moze imati najvise 1200 karaktera.")
    .transform((value) => value || undefined),
  website: z.string().max(0, "Zahtev nije poslat. Proverite polja i pokusajte ponovo."),
})

export async function submitDemoLeadAction(
  _previousState: DemoLeadActionState,
  formData: FormData
): Promise<DemoLeadActionState> {
  const rawPayload = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    agencyName: String(formData.get("agencyName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    departuresPerDay: String(formData.get("departuresPerDay") ?? ""),
    message: String(formData.get("message") ?? ""),
    website: String(formData.get("website") ?? ""),
  }

  const validationResult = demoLeadSchema.safeParse(rawPayload)

  if (!validationResult.success) {
    return {
      ...initialErrorState,
      message: validationResult.error.issues[0]?.message || initialErrorState.message,
    }
  }

  const response = await fetch(`${getApiBaseUrl()}/api/public/marketing/leads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(validationResult.data),
    cache: "no-store",
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const message = Array.isArray(body?.message) ? body.message.join(", ") : body?.message

    return {
      ...initialErrorState,
      message: message || initialErrorState.message,
    }
  }

  return {
    status: "success",
    message: "Hvala! Zahtev je poslat. Javljamo se sa odgovorom i narednim koracima.",
  }
}
