import Link from "next/link"

import { notFoundCopy } from "@/components/errors/not-found-copy"
import { localizePathname } from "@/i18n/routing"

export function StorefrontNotFound() {
  const { locale, t } = notFoundCopy("storefront")

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-24 text-white">
      <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-white/60">{t("badge")}</p>
        <h1 className="mt-3 text-3xl font-bold">{t("title")}</h1>
        <p className="mt-4 text-white/70">{t("description")}</p>
        <Link
          href={localizePathname(locale, "/login")}
          className="mt-8 inline-flex rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-950"
        >
          {t("toLogin")}
        </Link>
      </div>
    </div>
  )
}
