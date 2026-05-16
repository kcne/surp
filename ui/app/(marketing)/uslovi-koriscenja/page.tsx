import type { Metadata } from "next"
import { LegalPage } from "@/components/marketing/legal-page"
import { breadcrumbJsonLd, buildMetadata, jsonLd } from "@/lib/seo"

export const metadata: Metadata = buildMetadata({
  title: "Uslovi koriscenja",
  description: "Radna verzija uslova koriscenja SURP platforme za autobuske agencije.",
  path: "/uslovi-koriscenja",
})

export default function UsloviKoriscenjaPage() {
  const breadcrumbs = breadcrumbJsonLd([
    { name: "SURP", path: "/" },
    { name: "Uslovi koriscenja", path: "/uslovi-koriscenja" },
  ])

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }} />
      <LegalPage
        title="Uslovi koriscenja"
        description="Ovi uslovi opisuju osnovna pravila koriscenja SURP platforme i marketing sajta."
        updatedAt="2026-05-16"
        sections={[
          {
            title: "Prihvatanje uslova",
            body: [
              "Koriscenjem SURP sajta ili zakazivanjem demo razgovora prihvatate ove uslove u meri u kojoj se odnose na javni marketing deo proizvoda.",
              "Uslovi za placenu upotrebu platforme definisu se posebnim ugovorom ili porudzbenicom izmedju SURP-a i autobuske agencije.",
            ],
          },
          {
            title: "Opis usluge",
            body: [
              "SURP je web platforma namenjena autobuskim agencijama za vodjenje linija, voznih redova, rezervacija, putnika, storefront-a i izvestaja.",
              "Javni marketing sajt sluzi za informisanje, prikupljanje demo zahteva i objavu edukativnog sadrzaja.",
            ],
          },
          {
            title: "Demo zahtevi",
            body: [
              "Podaci poslati kroz kontakt formu koriste se za odgovor na zahtev, pripremu demo razgovora i komunikaciju o SURP proizvodu.",
              "Zabranjeno je slanje laznih, tudjih ili automatizovanih prijava kroz kontakt formu.",
            ],
          },
          {
            title: "Dostupnost i izmene",
            body: [
              "Trudimo se da sajt bude dostupan i tacan, ali ne garantujemo neprekidan rad niti odsustvo gresaka u svakoj situaciji.",
              "Sadrzaj, funkcije i planovi mogu se menjati kako se proizvod razvija.",
            ],
          },
          {
            title: "Odgovornost",
            body: [
              "Informacije na sajtu imaju informativni karakter i ne predstavljaju obavezu isporuke konkretne funkcije bez posebnog dogovora.",
              "SURP ne odgovara za indirektnu stetu nastalu oslanjanjem na marketing materijale bez dodatne poslovne potvrde.",
            ],
          },
          {
            title: "Kontakt",
            body: [
              "Za pitanja o ovim uslovima mozete nas kontaktirati preko forme na kontakt strani ili email adrese navedene na sajtu.",
            ],
          },
        ]}
      />
    </>
  )
}
