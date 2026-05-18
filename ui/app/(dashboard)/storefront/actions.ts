"use server"

import { revalidateTag } from "next/cache"
import {
  getApiBaseUrl,
  type StorefrontAssetPresignResponse,
  type StorefrontAdminResponse,
  type StorefrontUpdatePayload,
} from "@/lib/storefront"

interface StorefrontActionAuth {
  accessToken: string
  tenantSlug: string
}

function buildHeaders(auth: StorefrontActionAuth): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${auth.accessToken}`,
    "X-Tenant-Slug": auth.tenantSlug,
  }
}

async function parseStorefrontResponse(response: Response): Promise<StorefrontAdminResponse> {
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const message = Array.isArray(body?.message) ? body.message.join(", ") : body?.message
    throw new Error(message || "Zahtev za javni izlog nije uspeo")
  }

  return response.json()
}

export async function getStorefrontAction(auth: StorefrontActionAuth): Promise<StorefrontAdminResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/storefront`, {
    headers: buildHeaders(auth),
    cache: "no-store",
  })

  return parseStorefrontResponse(response)
}

export async function saveStorefrontAction(
  auth: StorefrontActionAuth,
  payload: StorefrontUpdatePayload
): Promise<StorefrontAdminResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/storefront`, {
    method: "PUT",
    headers: buildHeaders(auth),
    body: JSON.stringify(payload),
    cache: "no-store",
  })

  const storefront = await parseStorefrontResponse(response)
  revalidateTag(`agency:${storefront.tenantSlug}`)
  return storefront
}

export async function publishStorefrontAction(auth: StorefrontActionAuth): Promise<StorefrontAdminResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/storefront/publish`, {
    method: "POST",
    headers: buildHeaders(auth),
    cache: "no-store",
  })

  const storefront = await parseStorefrontResponse(response)
  revalidateTag(`agency:${storefront.tenantSlug}`)
  return storefront
}

export async function unpublishStorefrontAction(auth: StorefrontActionAuth): Promise<StorefrontAdminResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/storefront/unpublish`, {
    method: "POST",
    headers: buildHeaders(auth),
    cache: "no-store",
  })

  const storefront = await parseStorefrontResponse(response)
  revalidateTag(`agency:${storefront.tenantSlug}`)
  return storefront
}

export async function presignRideIconUploadAction(
  auth: StorefrontActionAuth,
  payload: { fileName: string; mimeType: string; sizeBytes: number }
): Promise<StorefrontAssetPresignResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/storefront/assets/ride-icon/presign-upload`, {
    method: "POST",
    headers: buildHeaders(auth),
    body: JSON.stringify(payload),
    cache: "no-store",
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const message = Array.isArray(body?.message) ? body.message.join(", ") : body?.message
    throw new Error(message || "Kreiranje upload URL-a nije uspelo")
  }

  return response.json()
}

export async function completeRideIconUploadAction(
  auth: StorefrontActionAuth,
  payload: { storageKey: string; fileName: string; mimeType: string; sizeBytes: number }
): Promise<StorefrontAdminResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/storefront/assets/ride-icon/complete`, {
    method: "POST",
    headers: buildHeaders(auth),
    body: JSON.stringify(payload),
    cache: "no-store",
  })

  const storefront = await parseStorefrontResponse(response)
  revalidateTag(`agency:${storefront.tenantSlug}`)
  return storefront
}
