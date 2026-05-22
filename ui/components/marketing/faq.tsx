import { MarketingSection } from "@/components/marketing/section"

export const faqItems = [
  {
    question: "Koliko traje implementacija?",
    answer: "Prva verzija sa vasim podacima, linijama, korisnicima, rezervacijama i javnim izlogom obicno traje do 14 dana.",
  },
  {
    question: "Da li migrirate podatke iz postojeceg sistema?",
    answer: "Da. U pilot fazi migracija se dogovara po izvoru podataka: Excel, CSV ili postojeca baza.",
  },
  {
    question: "Da li putnici mogu da rezervisu online?",
    answer: "Da. SURP storefront omogucava javni pregled agencije i tok online rezervacije, uz brending agencije.",
  },
  {
    question: "Da li moramo odmah da naplacujemo karticama?",
    answer: "Ne. Online rezervacija i online placanje mogu da se uvode odvojeno, u skladu sa procesom agencije.",
  },
  {
    question: "Gde se cuvaju podaci?",
    answer: "Podaci se cuvaju bezbedno u cloudu, a podaci svake agencije su odvojeni od podataka drugih agencija.",
  },
  {
    question: "Sta ako zelimo sopstveni domen za javni sajt?",
    answer: "Povezivanje sopstvenog domena za javni sajt uskoro dolazi na platformu.",
  },
]

export function FAQ() {
  return (
    <MarketingSection id="faq" className="bg-white">
      <div className="mx-auto grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mk-indigo-600)]">
            Najcesce postavljana pitanja
          </p>
          <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.025em] text-[color:var(--mk-navy-900)] md:text-5xl">
            Odgovori pre nego sto pocnete sa koriscenjem.
          </h2>
          <p className="mt-4 text-lg leading-8 text-[color:var(--mk-text-muted)]">
            Saznajte kako funkcionisu implementacija, online rezervacije, podaci,
            domen i podrska za vasu autobusku agenciju.
          </p>
        </div>

        <div className="space-y-3">
          {faqItems.map((item) => (
            <details key={item.question} className="group rounded-2xl border border-[color:var(--mk-border)] bg-[color:var(--mk-bg-alt)] p-5 shadow-mk-sm">
              <summary className="cursor-pointer list-none font-semibold text-[color:var(--mk-navy-900)] marker:hidden">
                <span className="flex items-center justify-between gap-4">
                  {item.question}
                  <span className="text-xl text-[color:var(--mk-indigo-600)] transition-transform group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="mt-4 text-sm leading-6 text-[color:var(--mk-text-muted)]">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </MarketingSection>
  )
}
