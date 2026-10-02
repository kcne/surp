"use client"

import Image from "next/image"
import { useState } from "react"
import { Play } from "lucide-react"

export function HeroVideo() {
  const [shouldPlay, setShouldPlay] = useState(false)
  const [hasError, setHasError] = useState(false)

  if (shouldPlay && !hasError) {
    return (
      <video
        className="aspect-video w-full overflow-hidden rounded-2xl bg-[color:var(--mk-navy-900)] object-contain shadow-mk-glow sm:rounded-3xl"
        src="https://media.surp.rs/presentation-site.mp4"
        poster="/marketing/demo-poster.jpg"
        aria-label="Demo video SURP platforme"
        autoPlay
        controls
        playsInline
        preload="none"
        tabIndex={0}
        ref={(video) => video?.focus()}
        onError={() => setHasError(true)}
      />
    )
  }

  return (
    <button
      type="button"
      ref={(button) => {
        if (hasError) button?.focus()
      }}
      className="group relative block aspect-video w-full overflow-hidden rounded-2xl bg-[color:var(--mk-navy-900)] text-left shadow-mk-glow focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--mk-indigo-600)] focus-visible:ring-offset-4 sm:rounded-3xl"
      onClick={() => {
        setHasError(false)
        setShouldPlay(true)
      }}
      aria-label="Pusti demo video SURP platforme"
    >
      <Image
        src="/marketing/demo-poster.jpg"
        alt=""
        fill
        priority
        sizes="(min-width: 1280px) 1152px, calc(100vw - 48px)"
        className="object-cover"
      />
      <span className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent transition group-hover:bg-slate-950/20" />
      <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center text-black transition group-hover:scale-105 motion-reduce:transition-none sm:h-20 sm:w-20">
        <Play aria-hidden="true" strokeWidth={0} className="h-16 w-16 fill-current sm:h-20 sm:w-20" />
      </span>
      <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-4 pb-4 text-white sm:px-6 sm:pb-6">
        <span>
          <span className="block text-sm font-bold sm:text-lg">Pogledajte SURP u akciji</span>
          <span className="mt-1 block text-xs text-white/80 sm:text-sm">
            {hasError ? "Video nije dostupan. Kliknite da pokušate ponovo." : "Video prezentacija · 0:53"}
          </span>
        </span>
        <span aria-hidden="true" className="rounded bg-black/50 px-2 py-1 text-xs tabular-nums">0:00 / 0:53</span>
      </span>
      {hasError && <span role="alert" className="sr-only">Video nije dostupan. Pokušajte ponovo.</span>}
    </button>
  )
}
