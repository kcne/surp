"use client"

import Image from "next/image"
import { useState } from "react"
import { Play } from "lucide-react"

export function HeroVideo() {
  const [shouldPlay, setShouldPlay] = useState(false)

  if (shouldPlay) {
    return (
      <video
        className="aspect-video w-full overflow-hidden rounded-2xl bg-[color:var(--mk-navy-900)] object-contain shadow-mk-glow sm:rounded-3xl"
        src="/marketing/demo.mp4"
        poster="/marketing/demo-poster.svg"
        aria-label="Demo video SURP platforme"
        autoPlay
        controls
        muted
        playsInline
        preload="auto"
      />
    )
  }

  return (
    <button
      type="button"
      className="group relative block aspect-video w-full overflow-hidden rounded-2xl bg-[color:var(--mk-navy-900)] text-left shadow-mk-glow sm:rounded-3xl"
      onClick={() => setShouldPlay(true)}
      aria-label="Pusti demo video SURP platforme"
    >
      <Image
        src="/marketing/demo-poster.svg"
        alt=""
        fill
        priority
        sizes="(min-width: 1280px) 1152px, calc(100vw - 48px)"
        className="object-cover"
      />
      <span className="absolute inset-0 bg-slate-950/10 transition group-hover:bg-slate-950/20" />
      <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-full bg-white/95 px-5 py-3 text-sm font-bold text-[color:var(--mk-navy-900)] shadow-mk-lg transition group-hover:scale-105">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--mk-indigo-600)] text-white">
          <Play className="ml-0.5 h-5 w-5 fill-current" />
        </span>
        Pogledajte demo
      </span>
    </button>
  )
}
