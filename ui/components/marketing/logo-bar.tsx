const logos = ["Drina Bus", "Linea", "Adria Tours", "BalkanGo", "Transit Pro", "Nova Linija"]

export function LogoBar() {
  return (
    <section className="border-y border-[color:var(--mk-border)] bg-white py-8">
      <div className="mx-auto w-full max-w-7xl px-6 md:px-8 lg:px-12">
        <p className="text-center text-sm font-medium text-[color:var(--mk-text-muted)]">
          Napravljeno za agencije koje zele manje telefona, manje tabela i vise online rezervacija
        </p>
        <div className="mt-6 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
          <div className="flex w-max gap-4 animate-marquee hover:[animation-play-state:paused] motion-reduce:animate-none md:gap-6">
            {[...logos, ...logos].map((logo, index) => (
              <div
                key={`${logo}-${index}`}
                aria-hidden={index >= logos.length}
                className="flex h-12 min-w-36 items-center justify-center rounded-2xl border border-[color:var(--mk-border)] bg-[color:var(--mk-bg-alt)] px-5 font-display text-sm font-semibold text-[color:var(--mk-text-subtle)] transition hover:border-[color:var(--mk-indigo-100)] hover:bg-white hover:text-[color:var(--mk-navy-900)]"
              >
                {logo}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
