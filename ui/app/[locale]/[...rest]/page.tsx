import { notFound } from "next/navigation"

import { setActiveLocale } from "@/i18n/active-locale"
import { resolveRequestLocale } from "@/i18n/resolve-locale"

export default function UnknownPath({ params }: { params: { locale: string } }) {
  setActiveLocale(resolveRequestLocale(params))
  notFound()
}
