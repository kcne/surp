import type { Metadata } from "next"
import { LegalPage } from "@/components/marketing/legal-page"
import { breadcrumbJsonLd, buildMetadata, jsonLd } from "@/lib/seo"

export const metadata: Metadata = buildMetadata({
  title: "Politika privatnosti",
  description: "Radna verzija politike privatnosti SURP marketing sajta i demo forme.",
  path: "/politika-privatnosti",
})

export default function PolitikaPrivatnostiPage() {
  const breadcrumbs = breadcrumbJsonLd([
    { name: "SURP", path: "/" },
    { name: "Politika privatnosti", path: "/politika-privatnosti" },
  ])

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }} />
      <LegalPage
        title="Politika privatnosti"
        description="Ova politika objasnjava koje podatke prikupljamo na marketing sajtu i kako ih koristimo za demo komunikaciju."
        updatedAt="2026-05-16"
        sections={[
          {
            title: "Podaci koje prikupljamo",
            body: [
              "Kroz demo formu mozemo prikupiti ime, email adresu, naziv agencije, telefon, okvirni broj polazaka dnevno i poruku koju sami unesete.",
              "Sistem moze tehnicki zabeleziti IP adresu i osnovne server logove radi bezbednosti, dijagnostike i zastite od zloupotrebe.",
            ],
          },
          {
            title: "Svrha obrade",
            body: [
              "Podatke koristimo da odgovorimo na demo zahtev, pripremimo relevantan razgovor i procenimo koji SURP plan ili tok implementacije ima smisla za agenciju.",
              "Podatke ne koristimo za prodaju trecim licima.",
            ],
          },
          {
            title: "Pravni osnov",
            body: [
              "Obrada demo zahteva zasniva se na vasem zahtevu za komunikaciju i predugovornoj poslovnoj komunikaciji.",
              "Tehnicki logovi obradjuju se radi legitimnog interesa za bezbednost i stabilnost sajta.",
            ],
          },
          {
            title: "Cuvanje podataka",
            body: [
              "Demo lead podaci cuvaju se onoliko koliko je potrebno za prodajnu komunikaciju i poslovnu evidenciju, osim ako zatrazite brisanje ranije.",
              "Kada se uvede email, CRM ili analiticki provider, ova politika mora biti azurirana konkretnim nazivima obradjivaca.",
            ],
          },
          {
            title: "Kolacici i analitika",
            body: [
              "Marketing sajt trenutno ne zahteva non-essential kolacice za osnovni rad.",
              "Ako se doda privacy-friendly analitika ili drugi alati, politika ce biti azurirana pre javnog lansiranja.",
            ],
          },
          {
            title: "Vasa prava",
            body: [
              "Mozete zatraziti pristup, ispravku ili brisanje podataka koje ste poslali kroz demo formu.",
              "Za zahteve u vezi privatnosti koristite kontakt podatke navedene na sajtu.",
            ],
          },
        ]}
      />
    </>
  )
}
