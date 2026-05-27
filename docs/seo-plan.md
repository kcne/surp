# SURP SEO/AI Search Strategija 2026 — Tržišna Analiza + Slice Plan

> **Vidi takođe:** [docs/ai-search-plan.md](ai-search-plan.md) — posebna AI Search (GEO/AEO) napad-strategija sa slice-ovima AI-A do AI-H. Komplementarna je ovom dokumentu (slice-ovi SEO-E i SEO-G su temelj, AI-* su nadgradnja).

## Deo 1: Šta se promenilo u SEO svetu (Q1–Q2 2026)

**Najveće promene koje moramo da prihvatimo:**

1. **AI search je posebna disciplina, ali je "i dalje SEO"** — Google je 15. maja 2026. objavio novi AI Search guide gde eksplicitno kaže da su AEO i GEO "still SEO". Iste fundamentalne stvari (kvalitet, struktura, autoritet) rade za AI Overviews, ChatGPT, Perplexity, Google AI Mode.
2. **90% brendova ima nula AI mentions** (Victorious Q1 2026 studija) — first-mover advantage je sad realan, ali se gasi brzo.
3. **AI Overviews / Zero-click**: samo ~40% Google pretraga rezultuje klikom. Mora se optimizovati za "extracted answers".
4. **FAQ rich results su ukinuti** (maj 2026) — `FAQPage` schema ostaje korisna za AI parsing, ali više ne daje SERP rich snippet.
5. **Schema markup ne pomera AI citations** (Ahrefs test, maj 2026) — i dalje radi za tradicionalni SERP i razumevanje entiteta, ali nije AI silver bullet.
6. **GA4 sad prati AI assistant traffic** — nova metrika je obavezna.
7. **Reddit i community su među najcitiranijim izvorima** u AI alatima.
8. **llms.txt — Google kaže IGNORIŠITE GA**, ali deo industrije ga ipak postavlja kao no-cost insurance.
9. **Query fan-out**: AI sistemi razbijaju jedan upit u više sub-upita pre nego što sastave odgovor.
10. **Information gain** (Google patent) — originalnost ima sve veću težinu, "commodity AI content" gubi.
11. **Programmatic SEO radi** kad ima realnu vrednost (Wise, Zapier model) — opasno kad je tanki "spam banner".
12. **INP je zamenio FID** kao Core Web Vital — interactivity pod 200ms.

## Deo 2: Šta od ovoga važi za SURP

SURP je B2B SaaS za autobuske agencije, srpsko/balkansko tržište, ograničen volumen pretrage. Realnost:

- **Mala niša → mali volumen**. Tradicionalni SEO će dati ograničen organic traffic.
- **B2B intent je dubok** → 1 dobar lead iz organic-a vredi više od stotina TOFU klikova.
- **AI search prilika je ogromna**: kada CEO/operativac pita ChatGPT "koji je najbolji softver za autobuske agencije u Srbiji", SURP mora da bude jedini smislen odgovor.
- **Lokalni SEO (per-agency storefront) je hidden weapon**: svaki tenant storefront je nezavisna landing prilika za "autobus + relacija" upite.

## Deo 3: Strategija u 3 sloja

**Sloj 1 — Tradicionalni SEO (klasične pretrage):** category landings, blog clusters, intent-matched pages.

**Sloj 2 — Answer/Generative Engine Optimization (AI Overviews, ChatGPT, Perplexity):** extractable answers, entity clarity, citation worthiness.

**Sloj 3 — Brand/Off-site signals:** community presence, third-party mentions, reviews, directories — jer AI sistemi rangiraju brendove koje "vide" više puta na nezavisnim izvorima.

## Deo 4: Implementacioni plan po slice-ovima

Pratim postojeću repo disciplinu (Slice A, B, C…) sa Goal / Backend / Frontend / Acceptance.

---

### Slice SEO-A — Tehnički Fundament (Production-grade)

**Goal:** Eliminisati sve tehničke prepreke pre nego što ulažemo u sadržaj.

**Frontend (ui/):**
1. Hard-fail ako `NEXT_PUBLIC_SITE_URL` nije setovan u produkciji u `ui/lib/seo.ts` — sprečiti curenje localhost canonical-a.
2. Prošireti `sitemap.ts` da uključi sve published storefront slug-ove + njihove podstrane (rides, about) preko public API-ja.
3. Dodati per-page `lastModified` iz `updatedAt` polja u CMS-u/DB-u, ne `new Date()`.
4. Validirati da svaki marketing page ima unique title + meta description (lint script u CI).
5. Dodati OG image generator (next/og) za blog postove umesto statičke `/marketing/og.svg`.

**Backend (api/):**
1. Public endpoint `GET /api/public/seo/sitemap-data` koji vraća listu published agencija + blog posts + ride routes sa `updatedAt`.

**Acceptance:**
- Build crashes ako prod env nema `NEXT_PUBLIC_SITE_URL`.
- Lighthouse SEO score ≥ 95 na svim marketing rutama.
- Screaming Frog crawl: 0 duplicate titles, 0 missing meta descriptions, 0 broken canonicals.
- Rich Results Test prolazi za Organization, WebSite, TravelAgency, BlogPosting.

---

### Slice SEO-B — Core Web Vitals i Performance

**Goal:** Proći Core Web Vitals na svim public stranicama (LCP < 2.5s, INP < 200ms, CLS < 0.1).

**Frontend:**
1. Audit svih `next/image` upotreba — `priority` na hero, sizes prop, AVIF/WebP.
2. Eliminisati render-blocking JS na marketing stranama (analytics defer).
3. Storefront hero `<img>` u `ui/app/(storefront)/[agencySlug]/page.tsx` prebaciti na `next/image` sa LCP optimizacijom.
4. Smanjiti JS bundle marketing route group-a (analizirati šta klijent-side renderuje a ne mora).

**Acceptance:**
- PageSpeed Insights mobile score ≥ 90 na home, /funkcije, /cene, top storefront.
- INP < 200ms u realnim merenjima (CrUX kad postane dostupno).

---

### Slice SEO-C — Keyword Map + BOFU Landing Pages

**Goal:** Pokriti high-intent komercijalne upite sa dedikovanim landingom (umesto da sve gađa root /).

**Frontend (nove rute u `ui/app/(marketing)/`):**
1. `/softver-za-autobuske-agencije`
2. `/sistem-za-rezervacije-autobusa`
3. `/online-rezervacije-autobuskih-karata`
4. `/digitalizacija-autobuske-agencije`
5. `/vozni-red-online-sistem`

Svaki landing template:
- H1 koji eksplicitno sadrži primary keyword
- Direktan answer-style paragraf u prvih 100 reči (za AI extraction)
- "What it is / How it works / Why agencies switch" struktura
- Konkretni screenshots (ne samo SVG mock)
- FAQ sekcija (8-10 pitanja) sa JSON-LD
- Comparison tabela (vs ručni proces / Excel)
- CTA: Zakažite demo

**Acceptance:**
- Svih 5 stranica indexed u GSC u roku od 7 dana.
- Title length 50-60 chars, meta 140-160 chars, jedinstveni.
- Internal link iz home + footer + relevantnih blog postova.

---

### Slice SEO-D — Content Cluster Expansion (TOFU/MOFU)

**Goal:** Izgraditi 4 sadržajna pillar-a sa 5-7 podržavajućih članaka.

**Pillars:**
1. **Online rezervacije** (pillar = `/online-rezervacije-autobuskih-karata`)
2. **Operativa i vozni redovi** (pillar = `/vozni-red-online-sistem`)
3. **Digitalizacija agencije** (pillar = `/digitalizacija-autobuske-agencije`)
4. **SEO i online prisustvo za prevoznike**

**Content frontmatter mora da podrži:**
- `author` (real ime + uloga, ne brand)
- `reviewedBy` (za credibility signal)
- `updatedAt` (separate od `date`)
- `tags`
- `pillar` (parent landing)

**Backend:** Proširiti `ui/lib/blog.ts` parser da podrži ova polja + render Person schema u BlogPosting.

**Acceptance:**
- Svaki post min. 1200 reči, sa originalnim primerima (information gain).
- Author bio page (`/autori/[slug]`) sa Person schema.
- Cross-linking između pillar + supporting članaka (min 3 internal links po članku).

---

### Slice SEO-E — Answer Engine Optimization (AEO/GEO)

**Goal:** Učiniti SURP "extractable" za AI Overviews, ChatGPT, Perplexity, Gemini.

**Sve content stranice moraju da imaju:**

1. **TL;DR / Sažetak blok** na vrhu svake stranice — 2-3 rečenice direktnog odgovora.
2. **Definicione H2 sekcije** — "Šta je [pojam]?" sa odgovorom u prvoj rečenici ispod.
3. **Lists & comparison tables** (AI ih lakše ekstrahuje).
4. **Eksplicitne brojke i statistike** sa atribucijom — AI sistemi citiraju stranice sa konkretnim podacima.
5. **"Last updated: DD.MM.YYYY"** vidljivo u UI-u (freshness signal).

**Frontend:**
1. Reusable `<AnswerBlock>` komponenta — koristi se na vrhu svake landing/blog stranice.
2. `<KeyStats>` komponenta sa schema markup (Dataset ili Statistic).
3. Author/Organization schema sa `knowsAbout` polja koja jasno definišu domen.

**Acceptance:**
- Manuelni test u ChatGPT/Perplexity sa promptom: "Najbolji softver za autobuske agencije u Srbiji 2026" — SURP se pojavljuje u top 3 izvora ili u tekstu odgovora.
- Lighthouse Accessibility i SEO ≥ 95.

---

### Slice SEO-F — Programmatic SEO (Per-Agency Routes)

**Goal:** Iskoristiti tenant storefront-ove kao programmatic SEO sloj za "autobus + relacija" upite.

**Backend (api/):**
1. Za svaki published storefront, generisati per-route detail stranicu: `/{agencySlug}/linije/{origin-slug}-{destination-slug}`.
2. DTO mora da uključi: relacija, polasci, dani, cena (priceFrom), trajanje, schema.org `BusTrip` ili `TravelAction` data.
3. Snapshot freshness — kad agencija update-uje liniju, `revalidateTag("agency:{slug}:rides")`.

**Frontend:**
1. Nova ruta `ui/app/(storefront)/[agencySlug]/linije/[routeSlug]/page.tsx`.
2. `generateStaticParams` čita iz API-ja na build (ISR sa 1h revalidate).
3. `generateMetadata` sa unique title po relaciji: "Autobus {Polazak} - {Dolazak} | {Agencija}".
4. Lokalni FAQ section ("Koliko traje put?", "Koliko košta?", "Kada polazi?").
5. Breadcrumb schema + BusTrip JSON-LD.

**Quality gate (da ne padne u "spam pSEO" zamku):**
- Ne kreirati rutu ako relacija ima 0 polazaka.
- Ne kreirati ako agencija nema minimum profil podatke (logo, opis).
- Content threshold: min 300 reči efektivnog sadržaja po stranici.

**Acceptance:**
- 50+ per-route stranica indexed po launch-u (zavisi od broja realnih agencija).
- Svaka prolazi Rich Results Test za breadcrumb + travel.

---

### Slice SEO-G — AI/Agent Discoverability

**Goal:** Omogućiti AI sistemima i agentima da razumeju i citiraju SURP.

**Frontend:**
1. **llms.txt** — postaviti na `/llms.txt` (Next.js static route) sa kratkim opisom + ključnim linkovima. Google kaže ignorišu, ali Anthropic/Perplexity ekosistem ga koristi. Niska cena, opciona vrednost.
2. **Markdown verzije ključnih stranica** — `/funkcije.md`, `/cene.md` itd. (FastHTML pattern). Generisati iz istog source-a.
3. **Strukturirani entity graph**: Organization schema sa `sameAs` linkovima ka LinkedIn, Crunchbase, Twitter, GitHub.
4. **AI crawler robots rules**: explicitly allow GPTBot, ClaudeBot, PerplexityBot, Google-Extended u robots.ts (production only) — neka indeksiraju, to je upravo cilj.

**Backend:**
1. Audit `/api/public/*` rate limits za AI crawlere — verovatno previše agresivni za njih.

**Acceptance:**
- `/llms.txt` validira protiv llmstxt.org spec.
- Direct test: pitati Perplexity "what is SURP" — vraća tačan opis sa citatom ka sajtu.

---

### Slice SEO-H — Off-site Authority i Brand Signals

**Goal:** Izgraditi spomene koji AI sistemi vide kao third-party validation.

**Aktivnosti (nije pure code, ali se prati kao slice):**
1. **Google Business Profile** za SURP entitet.
2. **Bing Webmaster Tools** + IndexNow integracija (Next.js plugin) — automatski ping pri deploy-u.
3. **Listings**: Capterra, G2, Software Advice, GetApp (B2B SaaS direktorijumi).
4. **Reddit/forum presence**: r/serbia, r/balkans, transport forumi — odgovori na realna pitanja, ne self-promote.
5. **LinkedIn company page** + redovni posts (1x nedeljno).
6. **Guest posts/PR**: 2-3 članka godišnje na regionalnim biznis sajtovima.
7. **Wikipedia/Wikidata entry** za SURP kao softver (ako dostigne notability prag).

**Backend (mali code deo):**
1. IndexNow ping endpoint koji se zove iz CI/CD nakon prod deploy-a.

**Acceptance:**
- 10+ third-party mentions na external domenima u prva 3 meseca.
- Bing indexing zatvoren u 48h od deploy-a.

---

### Slice SEO-I — Merenje, GSC, AI Visibility Tracking

**Goal:** Bez merenja je sve gore samo nada. Postaviti merenje pre nego što počnemo da merimo uspeh.

**Frontend:**
1. GA4 setup — proveriti da AI assistant traffic source-ovi dolaze kako treba (novi GA4 feature iz 2026).
2. Custom dimensions za GA4: `pillar`, `landing_type`, `intent_stage`.
3. UTM standardizacija (sve eksterne kampanje).

**Process (ne code):**
1. GSC već povezan ✓ — dodati property za sve subdomene (ako se uvedu).
2. Bing Webmaster Tools setup.
3. Mesečni report template: top queries po klikovima, top landing pages, AI assistant share, position changes po pillar-u.
4. Manuelni AI visibility test (jednom mesečno, prompt-set od 20 upita) — log u spreadsheet.

**Acceptance:**
- Mesečni dashboard koji pokriva: GSC clicks/impressions, GA4 organic + AI sources, top 50 query positions, conversion od organic ka demo lead-u.

---

### Slice SEO-J — Continuous Optimization (svaki kvartal)

**Goal:** SEO nije projekat, nego operativa.

**Quarterly checklist:**
1. **Content refresh sprint** — update 3 najjača posta sa novim podacima.
2. **Query gap analysis** — GSC queries gde se pojavljujemo na poziciji 8-20 → optimizovati postojeći page ili napraviti novi.
3. **AI prompt test set rerun** — koji su novi competitors u AI odgovorima.
4. **Broken link / 404 audit**.
5. **Schema validation** preko Rich Results Test za sample od 20 URL-ova.
6. **Competitor delta** — šta je 1-2 konkurenata objavilo, gde imamo gap.

---

## Deo 5: Prioritizacija (šta prvo)

**Mesec 1:** Slice SEO-A (tehnički fundament) + Slice SEO-B (CWV) + Slice SEO-I (merenje).
**Mesec 2:** Slice SEO-C (BOFU landings) + Slice SEO-E (AEO patterns).
**Mesec 3:** Slice SEO-D (content cluster) + Slice SEO-G (AI discoverability).
**Mesec 4-6:** Slice SEO-F (programmatic) + Slice SEO-H (off-site).
**Kontinuirano:** Slice SEO-J.

### Brzi status update (27.05.2026)

- Slice SEO-C validiran za query "softver za autobuske agencije" (pozicija #1 na Google Search).

### Mini plan nakon osvajanja #1 pozicije

1. ✅ Obeležiti Slice SEO-C kao završen milestone za glavni BOFU query.
2. Optimizovati conversion layer na landing stranici (CTA, FAQ, comparison) da se poveća demo lead rate.
3. Uvesti mesečni monitoring za isti query (pozicija, CTR, competitors) i trigger za brzi refresh sadržaja ako padne rank.

---

## Deo 6: Anti-paterni koje NE radimo

Bazirano na 2026 istraživanju i Google smernicama:
- Mass AI-generated commodity content (Lily Ray 220-site studija: boom-bust pattern).
- Keyword stuffing u meta tagovima.
- Tanki programmatic SEO bez stvarne vrednosti po stranici.
- Investicija u AMP (mrtvo).
- Investicija u voice search optimization (Ahrefs: nije vredno).
- Opsesija FAQ rich results — schema ostaje ali rich snippet je gone.
- "llms.txt će rešiti AI search" — neće, Google ga ignoriše. Postavi ga jer je jeftino, ali nemoj da zavisi od toga.
