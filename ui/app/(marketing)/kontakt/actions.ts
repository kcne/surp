"use server"

import { getApiBaseUrl } from "@/lib/storefront"

export type DemoLeadActionState = {
  status: "idle" | "success" | "error"
  message: string
}

const initialErrorState: DemoLeadActionState = {
  status: "error",
  message: "Zahtev nije poslat. Proverite polja i pokusajte ponovo.",
}

export async function submitDemoLeadAction(
  _previousState: DemoLeadActionState,
  formData: FormData
): Promise<DemoLeadActionState> {
  const payload = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    agencyName: String(formData.get("agencyName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    departuresPerDay: String(formData.get("departuresPerDay") ?? ""),
    message: String(formData.get("message") ?? ""),
    website: String(formData.get("website") ?? ""),
  }

  const response = await fetch(`${getApiBaseUrl()}/api/public/marketing/leads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
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
    message: "Hvala! Demo zahtev je poslat. Javljamo se sa predlogom termina.",
  }
}
