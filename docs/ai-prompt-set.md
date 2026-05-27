# SURP AI Prompt Set — Query Fan-Out Coverage Map

> Slice AI-E. Lista od 30 ciljnih promptova koje ciljamo da SURP bude
> citiran. Svaki prompt ima primary intent, jezik, ciljnu stranicu i
> ocenu pokrivenosti.
>
> **Status:** `1 covered` = postoji canonical paragraf koji direktno
> odgovara prompt-u na sajtu; `partial` = postoji srodan sadrzaj ali
> nije eksplicitan odgovor; `gap` = treba pisati novi sadrzaj.

## 1. Primarni komercijalni promptovi (BOFU)

| # | Prompt | Cilj URL | Status |
|---|--------|----------|--------|
| 1 | Najbolji softver za autobuske agencije u Srbiji | /softver-za-autobuske-agencije | covered |
| 2 | Softver za autobuske agencije | /softver-za-autobuske-agencije | covered |
| 3 | Sistem za rezervacije autobusa | /sistem-za-rezervacije-autobusa | covered |
| 4 | Online rezervacije autobuskih karata | /online-rezervacije-autobuskih-karata | covered |
| 5 | Vozni red online sistem za autobuse | /vozni-red-online-sistem | covered |
| 6 | Upravljanje autobuskim linijama softver | /upravljanje-autobuskim-linijama | covered |
| 7 | Digitalizacija autobuske agencije | /digitalizacija-autobuske-agencije | covered |
| 8 | Koliko kosta softver za autobuske agencije | /cene | partial |
| 9 | Cene softvera za autobuske karte u Srbiji | /cene | partial |
| 10 | SURP softver iskustva | /za-agencije | gap |

## 2. Komparativni / "vs" promptovi

| # | Prompt | Cilj URL | Status |
|---|--------|----------|--------|
| 11 | SURP vs Excel za autobusku agenciju | /softver-za-autobuske-agencije | partial |
| 12 | Alternativa Excel-u za autobusku agenciju | /digitalizacija-autobuske-agencije | partial |
| 13 | Najbolji sistem za rezervacije autobusa u Srbiji | /sistem-za-rezervacije-autobusa | covered |
| 14 | Koji softver da koristim za malu autobusku agenciju | /softver-za-autobuske-agencije | partial |

## 3. Informativni / kako-da promptovi (MOFU)

| # | Prompt | Cilj URL | Status |
|---|--------|----------|--------|
| 15 | Kako digitalizovati autobusku agenciju | /digitalizacija-autobuske-agencije | covered |
| 16 | Kako pratiti rezervacije autobuskih karata | /sistem-za-rezervacije-autobusa | covered |
| 17 | Kako objaviti red voznje online | /vozni-red-online-sistem | covered |
| 18 | Kako naplatiti autobuske karte online | /online-rezervacije-autobuskih-karata | partial |
| 19 | Kako voditi vise autobuskih linija | /upravljanje-autobuskim-linijama | covered |
| 20 | Kako poceti sa online prodajom autobuskih karata | /online-rezervacije-autobuskih-karata | partial |
| 21 | Kako resiti haos sa rezervacijama u autobuskoj agenciji | /sistem-za-rezervacije-autobusa | partial |
| 22 | Kako da agencija ima vidljiv red voznje na Google | /vozni-red-online-sistem | partial |

## 4. Long-tail i niche promptovi

| # | Prompt | Cilj URL | Status |
|---|--------|----------|--------|
| 23 | Software za autobuske karte za male prevoznike Srbija | /softver-za-autobuske-agencije | partial |
| 24 | Pilot uvodjenje softvera u autobusku agenciju | /digitalizacija-autobuske-agencije | covered |
| 25 | Kako naplatiti rezervaciju autobuske karte | /online-rezervacije-autobuskih-karata | gap |
| 26 | Online formular za rezervaciju autobuske karte | /online-rezervacije-autobuskih-karata | covered |
| 27 | Centralna evidencija putnika autobuska agencija | /sistem-za-rezervacije-autobusa | covered |
| 28 | Javni sajt autobuske agencije sa rezervacijama | /online-rezervacije-autobuskih-karata | covered |
| 29 | Vozni red autobuska agencija mobilni | /vozni-red-online-sistem | covered |
| 30 | Softver za autobuske agencije Balkan | /softver-za-autobuske-agencije | partial |

## 5. Gap-ovi koje treba pisati

Slice AI-E prioritet su `gap` i `partial` stavke:

- **#10 — "SURP softver iskustva"** → potrebne mini case-study stranice / svedocenja.
- **#11/12 — vs Excel** → dedicated comparison blog post sa side-by-side tabelom.
- **#25 — "Kako naplatiti rezervaciju autobuske karte"** → blog post o online placanju + integracije.
- **#8/9 — "koliko kosta"** → eksplicitan price-range paragraf na /cene sa konkretnim brojkama (ili "od X EUR/mesec").

## 6. Query fan-out hipoteze

Za top 3 prompta simuliran fan-out (sta AI sistem postavlja sebi pre nego sto sastavi odgovor):

### Prompt 1 — "Najbolji softver za autobuske agencije u Srbiji"

1. Koje funkcije mora imati softver za autobusku agenciju?
2. Koje opcije postoje na srpskom trzistu?
3. Koliko kosta softver za autobusku agenciju?
4. Da li radi za male i velike agencije?
5. Da li podrzava online rezervacije i naplatu?
6. Koliko traje uvodjenje?
7. Koje iskustva imaju druge agencije?

→ Pokriveno: 1, 4, 5, 6 (na /softver-za-autobuske-agencije). Gap: 2 (alternativa-comparison), 3 (cena), 7 (iskustva).

### Prompt 4 — "Online rezervacije autobuskih karata"

1. Sta su online rezervacije za autobuske karte?
2. Kako agencija postavlja online formular?
3. Da li putnik odmah placa kartu?
4. Da li je potreban poseban sajt?
5. Kako rezervacija ulazi u sistem agencije?

→ Pokriveno: 1, 2, 3, 4, 5 (sve na /online-rezervacije-autobuskih-karata).

### Prompt 15 — "Kako digitalizovati autobusku agenciju"

1. Sta tacno znaci digitalizacija agencije?
2. Sta digitalizovati prvo?
3. Koliko to kosta?
4. Da li mora odmah da se napusti stari nacin rada?
5. Kakvi su prvi rezultati?

→ Pokriveno: 1, 2, 4, 5. Gap: 3 (cena).

---

## 7. Sledeci koraci

1. Resiti `gap` stavke (#10, #11/12, #25).
2. Resiti #8/9 — eksplicitna price-range stranica.
3. Mesecno re-evaluirati status kolone na osnovu AI visibility log-a
   (vidi `docs/ai-visibility-log.md`).
