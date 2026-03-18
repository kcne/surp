import Link from "next/link"
import { ArrowLeft, Home, SearchX } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="relative flex min-h-[calc(100vh-64px)] items-center justify-center overflow-hidden px-6 py-12">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-20 top-10 h-56 w-56 rounded-full bg-blue-300/30 blur-3xl" />
        <div className="absolute -right-16 bottom-8 h-64 w-64 rounded-full bg-cyan-300/25 blur-3xl" />
        <div className="absolute left-1/3 top-1/3 h-40 w-40 rounded-full bg-indigo-300/20 blur-3xl" />
      </div>

      <section className="w-full max-w-2xl rounded-2xl border bg-card/80 p-8 shadow-xl backdrop-blur-sm md:p-10">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <SearchX className="h-3.5 w-3.5" />
          Greska 404
        </div>

        <h1 className="mb-3 text-3xl font-bold tracking-tight md:text-4xl">Stranica nije pronadjena</h1>
        <p className="mb-8 max-w-xl text-sm text-muted-foreground md:text-base">
          Link koji ste otvorili ne postoji ili je prebacen. Mozete se vratiti nazad ili nastaviti na pocetnu
          stranicu platforme.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/dashboard">
              <Home className="mr-2 h-4 w-4" />
              Nazad na dashboard
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/reservations">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Idi na rezervacije
            </Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
