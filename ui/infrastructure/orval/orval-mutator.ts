import type { AxiosError, AxiosRequestConfig } from "axios"
import { httpClient } from "@/infrastructure/requests/http-client"

type OrvalRequestOptions = RequestInit

function normalizeHeaders(headers?: HeadersInit): Record<string, string> | undefined {
  if (!headers) {
    return undefined
  }

  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries())
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers)
  }

  const normalizedEntries = Object.entries(headers).map(([key, value]) => [key, String(value)])
  return Object.fromEntries(normalizedEntries)
}

export const customInstance = async <T>(
  url: string,
  options?: OrvalRequestOptions
): Promise<T> => {
  const axiosOptions = {
    ...(options ?? {}),
    url,
    method: options?.method as AxiosRequestConfig["method"] | undefined,
    headers: normalizeHeaders(options?.headers),
    data: options?.body,
    signal: options?.signal as AxiosRequestConfig["signal"],
  } as AxiosRequestConfig

  const response = await httpClient({
    ...axiosOptions,
  })

  return {
    data: response.data,
    status: response.status,
    headers: response.headers as unknown as Headers,
  } as T
}

export type ErrorType<ErrorData> = AxiosError<ErrorData>
