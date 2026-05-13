import Link from "next/link"

export default function StorefrontNotFound() {
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-24 text-white">
      <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-white/60">404</p>
        <h1 className="mt-3 text-3xl font-bold">Javni izlog agencije nije pronađen</h1>
        <p className="mt-4 text-white/70">Ova agencija nije objavljena ili trenutno nije dostupna.</p>
        <Link
          href="/login"
          className="mt-8 inline-flex rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-950"
        >
          Prijava za osoblje
        </Link>
      </div>
    </div>
  )
}
