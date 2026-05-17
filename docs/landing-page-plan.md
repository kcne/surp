# SURP Marketing Landing — SEO/UX Plan

> Autoritativni plan za marketinški sajt SURP platforme (B2B, target: autobuske agencije).
> Živi paralelno sa `docs/storefront-plan.md` (per-agency public sajt) i `ui/app/(storefront)/` rute (B2C, za putnike).
> Ovaj dokument je dovoljan da implementator (čovek ili Copilot) krene "od nule" bez dodatnih pitanja.

---

## 0. Odluke koje su zaključane (ne preispitivati)

| Tema | Odluka |
|---|---|
| Target | B2B — autobuske agencije i operateri u regionu |
| Jezik | Srpski (latinica), `lang="sr-Latn"`. i18n se može dodati kasnije bez restrukturisanja. |
| Lokacija u kodu | Postojeći `ui/` projekat, novi route group `app/(marketing)/` |
| URL strategija | `/` postaje marketing home. Postojeći `app/page.tsx` (koji radi `router.push("/reservations")`) **se uklanja**. Logovan korisnik dolazi direktno na `/reservations` preko link-a "Prijava" u navbar-u. |
| Struktura | One-pager `/` + posebne SEO strane: `/funkcije`, `/cene`, `/za-agencije`, `/blog`, `/kontakt` + pravne: `/uslovi-koriscenja`, `/politika-privatnosti` |
| Primarni CTA | "Zakažite demo" → forma + Cal.com embed (na `/kontakt` i u herou) |
| Sekundarni CTA | "Pogledajte funkcije" (anchor na sekciju), "Prijava" (na app) |
| Tipografija | **Inter** (body) + **Space Grotesk** (display/H1–H2). Oba preko `next/font/google` sa `display: swap`. |
| Paleta | Deep navy + indigo akcent, beli background, mineral neutrali |
| Vizuali | Pravi screenshotovi dashboard-a + mock UI cards (SVG/PNG) u feature sekcijama |
| Pricing | 3 plana (Starter / Pro / Enterprise), bez fiksnih cifara, "Kontaktirajte nas" za Enterprise |
| Analytics | Plausible (privacy-friendly, GDPR-safe bez cookie banner-a) — kasnija odluka, plan ostavlja kuku |
| Rendering | Sve **Server Components** + `generateMetadata`. Klijent komponente samo za: nav (mobile menu toggle), CTA forma, FAQ accordion, demo widget. |

---

## 1. Design tokeni

Sve se dodaje u `ui/app/globals.css` pod novim CSS varijablama. Postojeći `--brand-primary` (koristi ga storefront) se **ne dira**. Marketing koristi novi namespace `--mk-*`.

### 1.1 Boje

```css
:root {
  /* Brand */
  --mk-navy-900: #0B1220;   /* heading text, dark sections bg */
  --mk-navy-800: #111A2E;
  --mk-navy-700: #1B2742;
  --mk-indigo-600: #4F46E5; /* primarni CTA, linkovi, akcenti */
  --mk-indigo-500: #6366F1;
  --mk-indigo-100: #E0E7FF; /* soft tint za badges, hover */
  --mk-sky-500: #0EA5E9;    /* sekundarni akcent (grafovi, info) */

  /* Neutrali */
  --mk-bg: #FFFFFF;
  --mk-bg-alt: #F8FAFC;     /* alternating section bg */
  --mk-bg-dark: var(--mk-navy-900);
  --mk-border: #E2E8F0;
  --mk-text: #0F172A;       /* body */
  --mk-text-muted: #475569; /* lead, descriptions */
  --mk-text-subtle: #94A3B8;

  /* Semantički (reuse iz tailwind config-a gde ima smisla) */
  --mk-success: #059669;
  --mk-warning: #D97706;
  --mk-danger: #DC2626;
}
```

**WCAG provera (svako paljenje boje za tekst mora proći):**
- `--mk-text` (#0F172A) na `--mk-bg` (#FFFFFF) → 17.4:1 ✅ AAA
- `--mk-text-muted` (#475569) na #FFFFFF → 7.5:1 ✅ AAA
- `--mk-indigo-600` (#4F46E5) na #FFFFFF → 6.4:1 ✅ AA Large + AA
- Bela na `--mk-indigo-600` → 6.4:1 ✅ AA (CTA dugmad)
- Bela na `--mk-navy-900` → 18.5:1 ✅ AAA (dark sekcije)

### 1.2 Tipografija

```css
:root {
  --mk-font-sans: var(--font-inter), system-ui, sans-serif;
  --mk-font-display: var(--font-space-grotesk), var(--font-inter), system-ui, sans-serif;
}
```

Skala (modular, ratio 1.25 — Major Third), mobile-first sa responsive clamp:

| Token | Mobile | Desktop | Težina | Letter-spacing |
|---|---|---|---|---|
| `text-display` (H1 hero) | 36px / 1.1 | clamp(40px, 5vw, 64px) | 700 (Space Grotesk) | -0.02em |
| `text-h2` | 28px / 1.2 | clamp(32px, 4vw, 44px) | 600 (Space Grotesk) | -0.015em |
| `text-h3` | 22px / 1.25 | 28px / 1.3 | 600 (Space Grotesk) | -0.01em |
| `text-h4` | 18px / 1.3 | 20px / 1.35 | 600 (Inter) | 0 |
| `text-lead` | 18px / 1.5 | 20px / 1.6 | 400 (Inter) | 0 |
| `text-body` | 16px / 1.6 | 16px / 1.65 | 400 (Inter) | 0 |
| `text-small` | 14px / 1.5 | 14px / 1.55 | 400 (Inter) | 0 |
| `text-eyebrow` | 12px / 1 | 13px / 1 | 600 (Inter) UPPERCASE | 0.1em |

Pravila:
- H1 — **samo jedan po strani** (SEO). U herou.
- Linija teksta ≤ **70 znakova** (`max-w-[65ch]` ili `max-w-2xl/3xl` u Tailwindu).
- Body uvek `font-feature-settings: "cv02","cv03","cv04","cv11"` (Inter optical fix).
- Antialiased: `-webkit-font-smoothing: antialiased`.

### 1.3 Spacing & layout

- Container: `max-w-7xl` (1280px) + horizontalni padding `px-6 md:px-8 lg:px-12`.
- Section vertikalni spacing: `py-20 md:py-28 lg:py-32` (80/112/128px). Hero `pt-28 pb-24 md:pt-36 md:pb-32`.
- Grid gap: `gap-6 md:gap-8` za kartice, `gap-12 md:gap-16` između major blokova.
- 8px baseline grid — sve paddinge zaokruživati na multipleks od 4 (Tailwind default).

### 1.4 Border, shadow, radius

```css
--mk-radius-sm: 6px;
--mk-radius:    10px;   /* default kartica, dugme */
--mk-radius-lg: 16px;   /* glavni feature card-ovi */
--mk-radius-xl: 24px;   /* hero image frame */

--mk-shadow-sm:   0 1px 2px rgba(15,23,42,0.04);
--mk-shadow-md:   0 4px 12px rgba(15,23,42,0.06), 0 1px 3px rgba(15,23,42,0.04);
--mk-shadow-lg:   0 16px 40px -8px rgba(15,23,42,0.12), 0 4px 12px rgba(15,23,42,0.06);
--mk-shadow-glow: 0 0 0 1px rgba(79,70,229,0.10), 0 10px 40px -10px rgba(79,70,229,0.35);
```

### 1.5 Linije i dividers

- Sekcijski divider: 1px linija `--mk-border` ili `border-t` između major blokova. Ne koristiti hard linije unutar kartica — koristiti razmak.
- Subtle gradient line za hero accent: `linear-gradient(90deg, transparent, var(--mk-indigo-100), transparent)` ispod eyebrow tag-a.
- Hover state na nav-link: 2px underline `--mk-indigo-600` koji animira `scale-x` (Linear/Stripe pattern).

### 1.6 Motion

- Globalni easing: `cubic-bezier(0.16, 1, 0.3, 1)` (snappy ease-out).
- Trajanja: `150ms` (hover micro), `300ms` (state change), `500ms` (section reveal).
- **`prefers-reduced-motion: reduce`** uvek poštovati: sve `transition` i Framer Motion animacije ograničiti na opacity, bez translate.
- Scroll-reveal: lagano `opacity 0 → 1` + `translateY(12px → 0)`, jednom, sa `IntersectionObserver` (Framer Motion `whileInView` sa `viewport={{ once: true }}`).

### 1.7 Ikonografija

- **Lucide React** (već u Next/shadcn ekosistemu) — stroke 1.5, size 20 ili 24.
- Konzistentno: feature kartice koriste ikonu u "soft tile" — 48×48 zaobljeni kvadrat (`rounded-xl`) sa `bg-indigo-50` i indigo ikonom unutra.

---

## 2. Informaciona arhitektura i mapa sajta

```
/                      # Home (one-pager)
/funkcije              # Detaljnije po feature-u (SEO long-tail)
/cene                  # 3 plana + FAQ pricing
/za-agencije           # Use case + ROI argumenti, social proof
/blog                  # Lista postova
/blog/[slug]           # Pojedinačan post (BlogPosting JSON-LD)
/kontakt               # Forma + Cal.com + email/telefon
/uslovi-koriscenja     # Legal
/politika-privatnosti  # Legal
/sitemap.xml           # auto preko app/sitemap.ts
/robots.txt            # auto preko app/robots.ts
```

Navbar (sticky, max 6 stavki):
`Funkcije` · `Za agencije` · `Cene` · `Blog` · `Kontakt` · **[Zakažite demo]** (primarni CTA) + `Prijava` (text link)

Footer (4 kolone):
1. **Proizvod**: Funkcije, Cene, Za agencije, Roadmap (kasnije)
2. **Kompanija**: O nama (kasnije), Blog, Kontakt, Karijera (kasnije)
3. **Pravno**: Uslovi korišćenja, Politika privatnosti, Kolačići
4. **Brand block**: logo + slogan + social linkovi + jezik switcher (placeholder)

---

## 3. Home (one-pager) — sekcije

> Redosled je svesno izabran po AIDA principu (Attention → Interest → Desire → Action), sa social proof-om što ranije za smanjenje "buyer skepticism"-a.

### 3.1 Hero (`<section id="hero">`)

- **Eyebrow tag**: "PLATFORMA ZA AUTOBUSKE AGENCIJE"
- **H1 (draft copy)**: "Sve operacije vaše autobuske agencije na jednom mestu."
- **Lead (draft)**: "Linije, vozni redovi, rezervacije, putnici i agencijski sajt — SURP zamenjuje pet alata jednim sistemom. Postavljeno za 14 dana."
- **CTA primarni**: "Zakažite demo" (otvara `/kontakt` ili modal sa Cal.com)
- **CTA sekundarni**: "Pogledajte funkcije" (anchor `#funkcije`)
- **Trust micro-line ispod CTA**: "Bez kreditne kartice · Demo traje 30 min · Implementacija ≤14 dana"
- **Hero vizual**: screenshot dashboard-a (rides list ili schedule kalendar) u "tilted floating card" stilu sa subtle indigo glow shadow-om. Backup: SVG mock ako nema realnog screenshota.
- Pozadina: vrlo suptilan grid pattern (`radial-gradient` ili SVG dotted grid) sa indigo glow u gornjem desnom uglu.

Layout: 2-kolone desktop (60/40 tekst/vizual), 1-kolona mobile (vizual ispod).

### 3.2 Logo bar / social proof

- "Veruju nam vodeće agencije u regionu" (placeholder copy dok nema klijenata — može da kaže "Uskoro" sa wireframe logo strip-om ili da se sakrije iza feature flag-a).
- 5–7 logoa, grayscale, opacity 60%, hover → 100% color.

### 3.3 Problem framing (opciono ali jako CR-pozitivno)

- H2: "Tabela u Excelu, telefonski pozivi, blokčić rezervacija — vreme je za upgrade."
- 3 mini-kartice sa "pain pointima": rasute rezervacije, dvostruke prodaje, nepostojeći onlajn sajt.
- Vizuelno: minimalan, ikone u sivoj paleti pre nego što sledeća sekcija "razreši" sa indigo.

### 3.4 Features grid (`#funkcije`)

- H2: "Sve što vam treba za vođenje agencije"
- H3 lead: kratak opis
- **6 kartica** u 3×2 grid (desktop) / 1 kolona (mobile):

| Ikona | Naslov | Kratak opis |
|---|---|---|
| `Route` | Linije i stanice | Definišite mrežu, redosled stanica, distance, cene po segmentu |
| `Calendar` | Vozni redovi | Rasporedi po danima, sezonske varijacije, ad-hoc polasci |
| `Ticket` | Rezervacije | Manuelno i onlajn, prikaz zauzeća po sedištima |
| `Users` | Putnici | Baza putnika, istorija, loyalty (uskoro) |
| `Globe` | Javni sajt agencije | Branded storefront na `surp.com/vasa-agencija` — uključeno |
| `BarChart3` | Izveštaji | Prihodi po liniji, popunjenost, top destinacije |

Svaka kartica: ikona tile + naslov (H3) + 2 reda opisa. Hover: blagi `translateY(-2px)` + shadow-md → shadow-lg.

### 3.5 Deep-dive feature highlight #1 — "Onlajn rezervacije i agencijski sajt"

- Layout: 50/50 split, tekst levo, screenshot storefront-a desno.
- H2: "Vaši putnici rezervišu online. Vi vidite rezervaciju istog trenutka."
- 3 bullet-a sa check ikonom: SEO optimizovan, naplata kasnije/odmah, sopstveni brending (boje, logo, slike).
- CTA: "Pogledajte primer storefront-a →" (link na demo agency storefront).

### 3.6 Deep-dive feature highlight #2 — "Multi-tenant od dana 1"

- Mirror layout (vizual levo, tekst desno).
- H2: "Više brendova, jedan nalog."
- Za agencije koje rade kao agregator ili imaju više pravnih lica.

### 3.7 Social proof / testimonials

- 2–3 testimoniala u kartice sa avatarom, imenom, ulogom, agencijom.
- Placeholder dok nema klijenata: "Spremamo prve case study-je. [Budite prvi →]"

### 3.8 Pricing teaser

- 3 kartice (Starter / Pro / Enterprise) — skraćena verzija sa "Saznajte više →" linkom na `/cene`.
- Pro označen kao "Najpopularniji" (indigo border + badge).
- Nema fiksne cifre — "od €X/mesec" sa zvezdicom ili "Kontaktirajte za ponudu".

### 3.9 FAQ accordion

- 6–8 pitanja, najčešća iz B2B SaaS prodaje:
  - Koliko traje implementacija?
  - Da li migrirate podatke iz našeg trenutnog sistema?
  - Kako se naplata vrši putnicima? (online card / na stanici)
  - Da li ima ugovorni rok?
  - Hosting i podaci — gde se čuvaju? (GDPR, EU)
  - Postoji li mobilna aplikacija? (PWA / planirano)
  - Šta ako želimo sopstveni domen za storefront?
  - Da li možemo izvesti podatke?
- `FAQPage` JSON-LD na ovoj sekciji (rich snippet u Google-u).

### 3.10 Final CTA (closing band)

- Dark sekcija (`--mk-navy-900`), bela tipografija, indigo CTA dugme.
- H2: "Spremni da modernizujete svoju agenciju?"
- Lead: "30 minuta demonstracije. Bez obaveze. Sa konkretnim odgovorom da li smo dobri za vas."
- CTA: "Zakažite demo" + sekundarno "Pošaljite pitanje" (mailto: ili `/kontakt`).

### 3.11 Footer

Vidi §2.

---

## 4. Podstrane

### 4.1 `/funkcije`

- H1: "Funkcije SURP platforme"
- Lead: 1 rečenica.
- Po svakom feature-u (6) — duža sekcija sa: H2, screenshot, 3-5 bullet detalja, "Kako radi" mikro-tekst.
- Završni CTA band.
- Cilj SEO: "softver za autobusku agenciju", "rezervacioni sistem autobusi", "online prodaja autobuskih karata".

### 4.2 `/cene`

- H1: "Cenovnik"
- 3 kolone (Starter / **Pro** / Enterprise) — Pro istaknut.
- Tabela "Sve funkcije" ispod sa check/cross po planu (pomaže SEO za long-tail "X vs Y" pretrage).
- Pricing FAQ (5 pitanja).
- Garancija/trust badges: "30-dnevna probna verzija · Bez ugovornog roka · Otkazivanje u jednom kliku".

### 4.3 `/za-agencije`

- H1: "Zašto agencije biraju SURP"
- Use case story format: "Pre SURP-a" → "Sa SURP-om".
- ROI mini-kalkulator (klijent komponenta, opciono): broj polazaka mesečno × prosečna popunjenost → ušteda vremena/novca.
- Testimoniali (kada postoje).

### 4.4 `/blog` i `/blog/[slug]`

- Lista: kartice sa cover image, title, excerpt, datum, kategorija, vreme čitanja.
- Detail strana: MDX ili headless CMS (placeholder — markdown fajlovi u `content/blog/*.mdx` za V1).
- **BlogPosting JSON-LD** po članku (autor, datePublished, image, headline).
- **OG image** auto-generisanje preko `app/blog/[slug]/opengraph-image.tsx` (Next.js native).
- Sidebar: kategorije, najnovije, newsletter signup (opciono).

### 4.5 `/kontakt`

- 2 kolone: forma levo, Cal.com embed desno (`<iframe>` ili `@calcom/embed-react`).
- Forma polja: ime, email, naziv agencije, telefon (opc.), broj polazaka/dan (select), poruka.
- Submit → Server Action → emaila preko `api/` MailService (već postoji per storefront-plan §1).
- Honeypot polje + Turnstile/hCaptcha za spam (kasnije, plan beleži zahtev).
- Kontakt info ispod: email, telefon, adresa.

### 4.6 Pravne strane

- Statički MDX. Datum poslednje izmene u headeru. Tabela sadržaja desno (sticky).

---

## 5. SEO checklist (mandatory)

### 5.1 Tehnički SEO

- `app/(marketing)/layout.tsx`:
  - `<html lang="sr-Latn">`
  - Globalni `metadata` sa `metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL)`
  - `themeColor`, `manifest` linkovi
- Po strani `generateMetadata()`:
  - `title` (template `"%s · SURP"`), `description` (≤155 znakova, unikatan), `alternates.canonical`, `openGraph`, `twitter` card
- **`app/sitemap.ts`**: home + sve marketing strane + svi objavljeni blog postovi. Excluded: `(dashboard)`, `(auth)`, `(storefront)/[slug]` (storefront ima svoj sitemap per storefront-plan).
- **`app/robots.ts`**: `Allow: /`, `Disallow: /reservations, /dashboard, /auth, /tickets, /api`. Sitemap pokazuje na `/sitemap.xml`.
- **Canonical URL** na svakoj strani (preko `alternates.canonical` u metadata).
- **404 strana**: `app/(marketing)/not-found.tsx` sa pretragom + linkovima na top strane.

### 5.2 Strukturirani podaci (JSON-LD)

- **`Organization`** na home (logo, sameAs sa social URL-ovima, contactPoint).
- **`WebSite` + `SearchAction`** (sitelinks search box u Google rezultatima).
- **`Product` ili `SoftwareApplication`** na home + `/funkcije` (sa `aggregateRating` kada bude review-a).
- **`FAQPage`** na home FAQ sekciji i `/cene`.
- **`BlogPosting`** na svakom blog postu.
- **`BreadcrumbList`** na svim podstranama.
- **`Offer`** na `/cene` (po planu).

Implementacija: `<script type="application/ld+json">` injektovan u Server Component preko `dangerouslySetInnerHTML` sa **stripovanim** JSON-om (bez interpolacije korisničkog ulaza).

### 5.3 On-page SEO pravila

- 1 × H1 po strani, deskriptivan, sa primarnim keyword-om.
- H2/H3 logična hijerarhija.
- Image `alt` obavezan (lint pravilo iz Next.js ESLint already on).
- `next/image` svuda, `priority` samo na hero image.
- Internal linking: home → 3+ unutrašnjih, svaka podstrana → home i bar 2 sibling strane.
- URL slug-ovi: kratki, kebab-case, srpski reči (`/za-agencije`, `/uslovi-koriscenja`).
- Open Graph image: 1200×630, brandiran, generisan preko `opengraph-image.tsx` po strani.
- Favicon set (preko `app/icon.tsx` + apple-icon).

### 5.4 Performans / Core Web Vitals (LCP/INP/CLS budgets)

- **LCP < 2.0s** (cilj < 1.5s) — hero image preloaded preko `next/image priority`, WebP/AVIF, dimenzije eksplicitne.
- **CLS < 0.05** — sve slike sa `width`/`height`, fontovi `display: swap` + `font-display: optional` strategija razmotriti.
- **INP < 200ms** — minimalno klijent JS-a, Framer Motion samo gde treba.
- Server Components svuda gde nema interaktivnosti.
- `next/font/google` lokalno hostuje fontove (Inter + Space Grotesk).
- Treće strane (Cal.com, Plausible) — lazy učitavanje sa `next/script strategy="lazyOnload"` ili samo na `/kontakt`.
- Bez Google Fonts CDN-a u runtime-u, bez Google Analytics-a (Plausible umesto).
- Cilj Lighthouse score: Performance 95+, SEO 100, Accessibility 95+, Best Practices 100.

### 5.5 Keyword mapa (početna)

| Strana | Primarni KW | Sekundarni |
|---|---|---|
| `/` | sistem za autobuske agencije | softver autobus, online prodaja karata |
| `/funkcije` | rezervacije autobuskih karata | vozni red softver, putnici baza |
| `/cene` | cena sistema za autobuske agencije | sistem rezervacija cena |
| `/za-agencije` | digitalizacija autobuskog prevoza | upravljanje autobuskom agencijom |
| `/blog` | blog autobuski prevoz | (long-tail per post) |

---

## 6. UX best practices — primenjeno u planu

- **F-pattern hero** (eyebrow → H1 → lead → CTA, sve levo poravnato).
- **Primarni CTA iznad fold-a** + ponovljen na svakih 1–1.5 visine viewport-a (hero, after features, final band).
- **Maksimum 1 primarni CTA po sekciji** (nema "decision paralysis").
- **Hick's law**: navbar ≤ 6 stavki, footer kolone uravnotežene.
- **Fitts's law**: CTA dugmad min `min-h-12` (48px), padding `px-6 py-3` minimum.
- **Touch targets** ≥ 44×44px.
- **Kontrast** ≥ AA svuda, AAA za body tekst (vidi §1.1).
- **Keyboard nav**: vidljiv focus ring (`focus-visible:ring-2 ring-indigo-500 ring-offset-2`), tab redosled prirodan, skip-link "Preskoči na sadržaj" na vrhu.
- **Reduced motion**: vidi §1.6.
- **Form UX**: labelovi vidljivi (ne placeholder-as-label), inline validacija nakon blur-a, error poruke ispod inputa sa `aria-describedby`, success state jasna.
- **Loading states**: skeleton za blog listu, button `aria-busy` i spinner za submit.
- **Empty states**: blog bez postova → "Uskoro dolaze prvi članci. [Pretplatite se →]"
- **Mobile-first**: dizajn vrednovan na 360px širini, breakpoint-ovi `sm 640 / md 768 / lg 1024 / xl 1280`.
- **Sticky nav** sa shrink-on-scroll (manji padding posle 80px scroll-a) — diskretno.
- **Read time** na blog postovima.
- **Anchor linkovi** sa `scroll-margin-top` da ne padnu ispod sticky nav-a.
- **Microcopy** na svakom CTA: precizan ishod ("Zakažite 30-min demo" > "Pošalji").
- **Trust signaling** kroz: garancije, testimoniale, brojeve, hosting (EU), GDPR, certifikate (kada bude).

---

## 7. Pristupačnost (WCAG 2.2 AA — non-negotiable)

- Semantički HTML (`<header>`, `<main>`, `<nav>`, `<section>`, `<article>`, `<footer>`).
- `aria-label` na nav landmark-ovima ("Primarna navigacija", "Footer").
- Form elementi povezani sa `<label for>`.
- FAQ accordion: native `<details><summary>` ili Radix `Accordion` sa pravim `aria-expanded`.
- Boja **nikad jedini** nosilac informacije (npr. error stanje uz ikonu + tekst, ne samo crveni border).
- Slike: `alt` opisno; dekorativne → `alt=""`.
- Video/animacije: poštuju `prefers-reduced-motion`.
- Test automatizovano: `@axe-core/playwright` u jednom e2e specu po strani; ručno: keyboard-only prolaz, screen reader smoke test (VoiceOver/NVDA).

---

## 8. File struktura

```
ui/
├── app/
│   ├── (marketing)/
│   │   ├── layout.tsx              # marketing-only navbar + footer + JSON-LD WebSite/Organization
│   │   ├── page.tsx                # Home (one-pager, sve sekcije iz §3)
│   │   ├── opengraph-image.tsx     # auto OG za home
│   │   ├── funkcije/
│   │   │   ├── page.tsx
│   │   │   └── opengraph-image.tsx
│   │   ├── cene/
│   │   │   └── page.tsx
│   │   ├── za-agencije/
│   │   │   └── page.tsx
│   │   ├── blog/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/
│   │   │       ├── page.tsx
│   │   │       └── opengraph-image.tsx
│   │   ├── kontakt/
│   │   │   ├── page.tsx
│   │   │   └── actions.ts          # Server Action za demo formu
│   │   ├── uslovi-koriscenja/page.tsx
│   │   ├── politika-privatnosti/page.tsx
│   │   └── not-found.tsx
│   ├── sitemap.ts                  # auto sitemap (home + marketing + blog)
│   ├── robots.ts
│   ├── icon.tsx                    # favicon
│   ├── apple-icon.tsx
│   ├── layout.tsx                  # root — dodaje Space Grotesk pored Inter-a
│   └── page.tsx                    # ⚠️ BRIŠE SE — sada (marketing)/page.tsx zauzima `/`
├── components/
│   └── marketing/
│       ├── nav.tsx                 # client (mobile toggle)
│       ├── footer.tsx
│       ├── hero.tsx
│       ├── logo-bar.tsx
│       ├── features-grid.tsx
│       ├── feature-spotlight.tsx   # reusable za §3.5/§3.6
│       ├── pricing-cards.tsx
│       ├── testimonials.tsx
│       ├── faq.tsx                 # client (accordion)
│       ├── cta-band.tsx
│       ├── demo-form.tsx           # client
│       ├── section.tsx             # wrapper sa standard padding/container
│       ├── eyebrow.tsx
│       ├── jsonld.tsx              # helper za <script type="application/ld+json">
│       └── og-template.tsx         # shared OG image kompozicija
├── content/
│   └── blog/
│       └── *.mdx                   # blog postovi (V1)
└── lib/
    └── seo.ts                      # buildMetadata() helper, JSON-LD generatori
```

---

## 9. Implementacioni redosled (PR slices)

> Po istom modelu kao `docs/storefront-plan.md` — jedna deployabilna inkrementa po PR-u.

### Slice M1 — Foundation
- Premestiti `app/page.tsx` (redirect) — obrisati ili pretvoriti u `(app)/page.tsx`.
- Dodati `(marketing)/layout.tsx` sa nav + footer (statičan copy).
- Dodati `(marketing)/page.tsx` sa Hero + jednim placeholder feature gridom.
- Dodati Space Grotesk preko `next/font/google` u root layout.
- Update `tailwind.config.ts`: dodati `--mk-*` boje kao Tailwind colors (preko CSS varijabli), display font family.
- `app/sitemap.ts` + `app/robots.ts`.
- `lib/seo.ts` helperi.
- **Acceptance**: `/` renderuje marketing home, Lighthouse SEO ≥ 95.

### Slice M2 — Home full
- Sve sekcije iz §3 (Logo bar, Problem framing, Features grid, 2× Spotlight, Testimonials placeholder, Pricing teaser, FAQ, Final CTA).
- JSON-LD: Organization, WebSite, FAQPage.
- Stvarne ili mock screenshot slike u `public/marketing/`.
- **Acceptance**: home je production-ready, Lighthouse Perf ≥ 90 (sa pravim slikama optimizovanim).

### Slice M3 — Funkcije + Cene + Za agencije
- 3 podstrane sa full copy.
- Pricing cards komponenta deljena između home teasera i `/cene` strane.
- Pricing FAQ sa `FAQPage` JSON-LD na `/cene`.
- Breadcrumb JSON-LD na svim podstranama.

### Slice M4 — Kontakt + demo flow
- `/kontakt` strana, forma sa Server Action.
- Backend: novi `api/src/marketing-leads/` modul (POST `/api/public/marketing/lead`, rate-limited, šalje preko `MailService`). Reuse postojećeg MailService interface-a iz storefront plana (Slice A).
- Cal.com embed.
- Honeypot anti-spam.
- E2E test happy path + spam path.

### Slice M5 — Blog (MDX)
- `content/blog/*.mdx` čitanje, `next-mdx-remote` ili `@next/mdx`.
- Lista + detail strana.
- `BlogPosting` JSON-LD, OG image generisanje.
- 2–3 seed posta (drafted by content team).

### Slice M6 — Legal + finalni polish
- `/uslovi-koriscenja`, `/politika-privatnosti` (sadržaj iz pravnog tima, MDX).
- Cookie banner (samo ako se ikad doda non-essential cookie — sa Plausible-om verovatno ne treba).
- 404 polish.
- Analytics integracija (Plausible self-hosted ili managed).

---

## 9.5 Visual Direction — "Modern Startup" reference patterns

> Cilj: izgled koji bi prošao kao top Behance/Awwwards SaaS landing — Linear / Vercel / Stripe / Resend / Cal.com / Arc / Framer estetika. Ne smemo da "izgledamo kao 2015 Bootstrap tema".

### 9.5.1 Šta usvajamo (canonical patterns)

1. **Layered hero sa "ambient glow"**
   - Pozadinski conic ili radial gradient u indigo/violet, vrlo nisko alfa (8–12%), pomeren u gornji desni ugao.
   - Iznad njega: subtle dotted grid SVG (1px dot, 24px spacing, opacity 4%) — daje "tech blueprint" osećaj (Vercel, Linear pattern).
   - Hero vizual (dashboard screenshot) u **frosted card** sa subtle border + indigo glow shadow ispod (`shadow-glow`).

2. **Bento grid features** (Apple/Linear stil)
   - Umesto klasičnog 3×2 uniform grid-a — **asimetričan bento**: jedna velika kartica (2 col × 2 row), jedna široka (2 col × 1 row), 3 standardne. Svaka kartica ima drugi vizuelni focal point (mali grafikon, mini UI snimak, ikona+ilustracija).
   - Cards: `rounded-2xl`, suptilan `1px inset highlight` na vrhu (`box-shadow: inset 0 1px 0 rgba(255,255,255,0.6)` na svetlim, ili rgba(255,255,255,0.06) na tamnim card-ovima).

3. **Dark accent sekcije sa noise texture**
   - Najmanje jedna sekcija (final CTA + spotlight #2) na `--mk-navy-900` sa SVG noise overlay-em (`opacity: 3%`) — sprečava "flat" izgled.
   - Akcenti unutar dark sekcija: indigo glow, tanke gradient linije kao separator-e.

4. **Gradient text za eyebrow/highlight reči u H1**
   - Jedna ključna reč u H1 ima `bg-gradient-to-r from-indigo-500 via-indigo-400 to-sky-400 bg-clip-text text-transparent`.
   - Primer: "Sve operacije vaše autobuske agencije na **jednom mestu**." — "jednom mestu" gradient.
   - Koristiti maksimalno **jednom po strani** — inače gubi efekat.

5. **Animirani gradient border na primarnom CTA**
   - Dugme "Zakažite demo" ima 1px gradient border (indigo → violet → indigo) sa slow rotate animacijom (8s linear infinite). Inside fill ostaje solid indigo. Linear/Resend pattern. Disable na `prefers-reduced-motion`.

6. **Mali "live" detalji**
   - Animirani brojevi (count-up) na social proof metrikama ("12.000+ rezervacija mesečno") — pokreće `IntersectionObserver`, jednom.
   - Mini sparkline grafikon u jednoj bento kartici (statički SVG, ne live data).
   - "Pulse dot" pored "Live demo" linka u nav-u (mali zeleni krug sa `animate-ping`).

7. **Trust strip sa logoima**
   - Auto-scrolling marquee (slow, pauza na hover) umesto statičnog grida — moderniji utisak. Logos grayscale → color on hover.
   - Wrapper sa `mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent)` za fade na krajevima.

8. **Testimoniali u "stagger" layout-u**
   - Nije grid 3×1 — već 2-3 kartice raspoređene sa offset-om (npr. centralna lagano niže), svaka rotirana 0.5–1° (CSS `transform: rotate(-0.5deg)`). Daje "physical card" feel.
   - Veliki quote glif (`"`) kao dekorativni element, indigo-100, position absolute.

9. **Section transitions**
   - Između sekcija povremeno **diagonal divider** ili **soft wave SVG** umesto ravne linije — ali sparingly (maksimalno 2 puta na celom one-pageru, da ne bude kičasto).
   - Bolja opcija: alternirajuće `bg-white` i `bg-slate-50/30` sekcije + jedna dark sekcija kao "rest stop" za oko.

10. **Pricing kartica "Recommended" highlight**
    - Pro plan kartica: gradient border (indigo → violet), badge "Najpopularniji" floating iznad sa indigo bg + bela tipografija + mala zvezdica/sparkle ikona.
    - Lagano scale-ovan (`scale-105`) na desktop-u u odnosu na ostale dve.

11. **Cursor-following spotlight u hero-u (opciono, Linear pattern)**
    - Radial gradient na 200×200px koji prati mouse, vrlo niska opacity. Samo desktop (`@media (hover: hover) and (pointer: fine)`). Disable na reduced-motion.
    - Implementacija: jedna mala klijent komponenta sa `mousemove` listener-om + CSS custom properties.

12. **Tipografska bravura**
    - H1 koristi **negativan letter-spacing** (`-0.025em`) za premium izgled na velikim veličinama.
    - **OpenType ligatures** uključene globalno: `font-feature-settings: "ss01", "cv02", "cv03", "cv04", "cv11"` (Inter optical ispravke).
    - Tabular nums za sve cifre u pricing/metrics: `font-variant-numeric: tabular-nums`.

### 9.5.2 Šta odbijamo (anti-patterns)

- ❌ Stock fotografije sa "business people shaking hands" — odmah šalje "dosadan B2B" signal.
- ❌ Veliki autoplay video u hero-u — INP/LCP killer + kičast za 2026.
- ❌ Parallax scroll efekti — performance & nausea, izvan trenda.
- ❌ Skeuomorphic shadow-i (5+ layer-a shadow-a, neon glow-ovi preko svega).
- ❌ Više od 3 boje akcenta — paleta mora ostati restriktivna.
- ❌ Animacije koje blokiraju čitanje (sekcije koje "fade in" tek kad scroll dođe — radimo to ali sa kratkim trajanjem 300–500ms, ne sa 1500ms reveal-ima).
- ❌ Round cartoon ilustracije (undraw.co stil) — outdated, neutralne SVG ili pravi UI screenshot-ovi.
- ❌ Gradient-i preko celih sekcija ("Bootstrap pink-to-orange").

### 9.5.3 Inspiracije (za review pre svake sekcije)

| Sekcija | Reference (gledati pre coding-a) |
|---|---|
| Hero | linear.app, resend.com, arc.net, framer.com |
| Bento features | apple.com (iPhone landing), linear.app/features, vercel.com |
| Pricing | cal.com/pricing, linear.app/pricing, stripe.com/pricing |
| Dark CTA | vercel.com (footer band), planetscale.com |
| Testimoniali | resend.com, cal.com, attio.com |
| FAQ | linear.app, posthog.com |
| Blog | vercel.com/blog, stripe.com/blog, linear.app/changelog |

### 9.5.4 Implementacioni alati

- **`tailwindcss`** core + plugin-i koje već imamo (`tailwindcss-animate`).
- **`framer-motion`** za scroll-reveal, count-up, stagger animacije. Lazy import u klijent komponentama.
- **`clsx` + `tailwind-merge`** (verovatno već prisutni preko shadcn) za conditional classes.
- **`lucide-react`** za ikone (već u shadcn ekosistemu).
- **Custom SVG-ovi** za: dotted grid pattern, noise texture, dekorativne linije — sve u `public/marketing/svg/` ili inline u komponentama.
- **Brand asset folder**: `public/marketing/` (logos, screenshots, OG fallback image, favicon source).

### 9.5.5 Visual QA checklist (pre PR merge-a po slice-u)

- [ ] Side-by-side screenshot sa jednom Linear/Vercel/Resend stranom — da li "stoji" kraj njih?
- [ ] Mobile screenshot na 360px — da li hijerarhija drži ili se gnječi?
- [ ] Dark sekcija ima dovoljno suptilnih akcenata da ne izgleda "flat"?
- [ ] Najmanje 1 "delight" detalj po sekciji (animacija, micro-interaction, vizuelni twist)?
- [ ] Lighthouse Performance ≥ 90 nakon dodavanja svih efekata?
- [ ] `prefers-reduced-motion` test — sve animacije gracefully off?
- [ ] Bez stock fotografija, bez generic ilustracija?

---

## 10. Otvoreni TODO-i / izvan ovog plana

- Pravni tekst (Uslovi, Privacy) — potreban input pravnog tima.
- Realni screenshot-ovi dashboard-a i storefront-a (zameniti mock-ove).
- Početna lista logoa klijenata (ili sakriti sekciju iza feature flag-a).
- Brand asset: finalni logo SVG (ako postoji izvan repo-a) → `public/marketing/logo.svg` + dark varijanta.
- Domen i hosting plan za marketing (verovatno isti Railway deploy — već je `ui/` jedan servis).
- i18n strategija — pripremiti slugove tako da podržavaju `/en/*` rute kasnije bez restrukturisanja.
- A/B testing infrastruktura — ostavljeno za fazu nakon prvih klijenata.
