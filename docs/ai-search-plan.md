# SURP AI Search Napad — Plan u Sliceovima (Q2–Q4 2026)

> Cilj: kada CEO/operativac autobuske agencije pita ChatGPT, Perplexity, Google AI Mode, Claude ili Gemini "koji je najbolji softver za autobuske agencije u Srbiji", SURP bude prvi/jedini smisleni odgovor, sa tačnim opisom i klikabilnim citatom.

---

## Deo 1: Šta zaista pomera AI citations (sažetak istraživanja)

Bazirano na Semrush GEO guide (april 2026), Microsoft AEO/GEO whitepaper, Princeton GEO study i Ahrefs/Aleyda Solís nalazima:

1. **GEO = SEO + brand mentions + extractability.** AI sistemi se hrane iz istog weba; ali biraju izvore koji su autoritativni, jasni i citatabilni.
2. **Unlinked brand mentions imaju visoku težinu** za AI rangiranje — bitno je samo da se ime brenda pojavljuje uz domen (npr. "softver za agencije") na trećim sajtovima.
3. **Statistike i citati u sadržaju daju +30–40% AI visibility** (Princeton studija, 10k upita). Brojke i citati su skoro obavezni.
4. **Server-side rendering je obavezan** za AI crawlere — JS-rendered sadržaj se često ne vidi.
5. **Wikipedia i UGC platforme (Reddit, YouTube, LinkedIn)** su disproporcionalno citirane.
6. **Fresh content** — AI sistemi preferiraju nedavno ažurirano.
7. **Strukturirana ekstrakcija**: TL;DR, definicione H2, tabele, liste — formati koje LLM lako parsira.
8. **Tools za AI tracking ne menjaju ranking** (slučaj Lorelight gašenja, novembar 2025) — služe samo za merenje, ne za optimizaciju.
9. **Entity clarity**: AI mora da zna šta tačno SURP jeste, za koga, gde — kroz konzistentan opis na sajtu, schema, Wikipedia/Wikidata, listinge.
10. **Prompt distribution**: query fan-out razbija jedan upit u 5–15 pod-upita; treba pokriti i pitanja koja korisnik ne kuca direktno.

### Šta NE radimo

- Slepo dodavanje statistika bez vrednosti za čitaoca.
- "AI-only" stranice koje su lošije za ljude.
- Investicija u GEO tracking alate pre nego što imamo bazu (mere posledice, ne uzroke).
- llms.txt kao spasilac — postavljamo ga, ali ne zavisimo od njega.

---

## Deo 2: Šta od ovoga važi za SURP

- B2B niša + srpsko/balkansko tržište → AI visibility ima izrazito visok prinos po investiciji jer konkurencija praktično ne radi GEO.
- Već imamo #1 na Google za "softver za autobuske agencije" → autoritet entiteta je delom utvrđen.
- Glavni jaz: **third-party signali** (Wikipedia, Reddit, LinkedIn, B2B direktorijumi) i **strukturirana ekstrakcija sadržaja** (TL;DR, statistike, definicione sekcije, autor schema).
- Drugi jaz: **AI crawler pristup** — moramo eksplicitno dozvoliti GPTBot, ClaudeBot, PerplexityBot, Google-Extended, Applebot-Extended.

---

## Deo 3: Implementacioni plan po slice-ovima

Pratim postojeću repo disciplinu (Goal / Backend / Frontend / Acceptance).

---

### Slice AI-A — AI Crawler Access i Tehnički Pristup

**Goal:** Garantovati da glavni AI crawleri mogu da indeksiraju SURP bez 429, JS-only sadržaja ili pogrešnih robots pravila.

**Frontend (ui/):**
1. `ui/app/robots.ts` — eksplicitno dozvoliti GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot, anthropic-ai, PerplexityBot, Perplexity-User, Google-Extended, Applebot-Extended, Bytespider, CCBot, Bingbot. Produkcija samo.
2. Provera da sve marketing rute i blog rute koriste server komponente (RSC) ili SSR, ne client-side render za glavni sadržaj.
3. Dodati `Vary: User-Agent` header ako serviramo različit sadržaj (ne bi trebalo, ali validacija).

**Backend (api/):**
1. Audit rate limita za `/api/public/*` — beli identifikovani AI crawler User-Agent-i (bez auth) sa višim limitom, ili posebnim bucket-om.
2. Logovati AI crawler hitove (UA matching) u platform-audit za vidljivost.

**Acceptance:**
- Manuelni curl test sa GPTBot/ClaudeBot/PerplexityBot UA: 200, HTML sadržaj sa H1 i primarnim paragrafom u response body-ju (bez JS execution).
- 0 AI crawler hitova vraća 429/5xx u 7-dnevnom prozoru (production logs).
- robots.txt validira u Google Robots Testeru i ne blokira pomenute UA.

---

### Slice AI-B — Extractable Content Sloj (TL;DR, AnswerBlock, KeyStats)

**Goal:** Svaka važna stranica nudi jasan, kratak odgovor i konkretne podatke koje LLM može da kopira u svoj rezime.

**Frontend (ui/):**
1. Već postoji `AnswerBlock` i `KeyStats` — proširiti pokrivanje na sve marketing rute i blog postove (ne samo SEO landing).
2. Dodati novi `<TLDR>` blok (može biti specijalizacija AnswerBlock) na vrh svake landing/blog stranice — 2–3 rečenice, eksplicitno označen kao sažetak.
3. Svaki BOFU landing dobija minimum 5 konkretnih brojki u `KeyStats` (npr. "do 14 dana uvodjenje", "20% manje telefonskih provera"). Brojke moraju biti iskrene; ako nemamo podatak, izbacujemo statistiku, ne izmišljamo.
4. Dodati "Šta je X?" definicionu sekciju kao H2 + prva rečenica koja je samostalan odgovor.
5. "Ažurirano: DD.MM.YYYY" vidljivo iznad fold-a (već postoji na SEO landing-u, proširiti na blog).

**Backend (ui/lib/landing-pages.ts):**
1. Proširiti `LandingPage` tip sa opcionim `tldr: string` i `sources?: Array<{label, url}>`.
2. Popuniti `tldr` na svih 6 BOFU stranica sa 2–3 rečenice direktnog odgovora.

**Acceptance:**
- Manuelni test: na svakom landingu prva 200 reči sadrže direktan odgovor na primarni query.
- Lighthouse SEO score ostaje ≥ 95.
- Tekstualni curl prikaz (bez JS) sadrži TL;DR i KeyStats vrednosti.

---

### Slice AI-C — Entity Graph i Schema Konzistencija

**Goal:** AI sistemi moraju da znaju ko je SURP, šta radi, gde radi, ko ga stoji iza, bez ambigvitnih signala.

**Frontend (ui/):**
1. Centralni `Organization` JSON-LD u root layout-u: `name`, `legalName`, `url`, `logo`, `description`, `foundingDate`, `areaServed: "RS"`, `knowsAbout: ["bus reservations", "softver za autobuske agencije", ...]`, `sameAs: [LinkedIn, Crunchbase, X, GitHub, YouTube]`.
2. Svaki SEO landing dodaje `SoftwareApplication` schema sa `applicationCategory: BusinessApplication`, `featureList`, `audience: TransportationProvider`.
3. Blog `BlogPosting` schema sa `author` (Person sa `jobTitle`, `url`, `sameAs`) i `reviewedBy` ako postoji.
4. Konzistentan opis brenda (1 paragraf, ~50 reči) reuse-ovan svuda — meta description, JSON-LD, footer, llms.txt.

**Process:**
1. Master "brand entity" snippet u repou (`ui/content/brand-entity.json`) iz koga se generišu sva mesta — eliminacija drift-a.

**Acceptance:**
- Rich Results Test prolazi za Organization, SoftwareApplication, BlogPosting.
- Google Knowledge Graph API (ručna provera): vraća SURP entitet sa tačnim opisom u roku 30 dana od deploy-a.
- `sameAs` profili svi su živi i vraćaju 200.

---

### Slice AI-D — Third-Party Mention Sprint (Wikipedia, Reddit, B2B Listings)

**Goal:** Izgraditi 10–20 nezavisnih spomena SURP-a sa tačnim opisom u prvih 60 dana. Ovo je najveći leverage za AI citation.

**Aktivnosti (non-code):**
1. **Wikidata entry** za SURP kao softver (pre Wikipedia). Wikidata je AI-relevantan i ima niži notability prag.
2. **Wikipedia članak na sr.wikipedia** kad imamo dovoljno secondary citations (~3 nezavisna pomena u medijima).
3. **B2B SaaS direktorijumi**: Capterra, G2, Software Advice, GetApp, SourceForge, AlternativeTo, SaaSworthy, Slashdot — kreirati listing sa konzistentnim opisom iz `brand-entity.json`.
4. **Lokalni direktorijumi**: PrivrednaKomora, Privredni vodici, biznis.rs, srpski IT katalozi.
5. **LinkedIn company page**: 1 post nedeljno, minimum 12 postova u kvartalu — autoritet osoba iz tima sa "SURP" u tekstu.
6. **Reddit prisustvo**: r/serbia, r/balkans, r/sysadmin, r/SaaS — 2 odgovora nedeljno na realna pitanja (ne self-promote), sa brand mention kad je relevantno.
7. **YouTube**: 1 demo screencast video mesečno, transcript u opisu (Whisper).
8. **Guest post / PR**: 2–3 članka u srpskim biz medijima (Biznis.rs, eKapija, Netokracija) — ovo daje Wikipedia notability + AI third-party signal.

**Backend (mali code deo):**
1. Skripta `api/scripts/check-third-party-mentions.ts` koja jednom mesečno proverava listu URL-ova i šalje izveštaj (lista linkova, status, da li sadrže "SURP").

**Acceptance:**
- 10+ third-party mentions u prva 3 meseca.
- 5+ B2B listinga publikovano.
- 1 Wikidata entry live.
- LinkedIn: 12+ postova sa brand mention.

---

### Slice AI-E — Prompt Coverage i Query Fan-Out

**Goal:** Pokriti pod-upite koje AI sistem postavlja sebi pre nego što sastavi odgovor (query fan-out).

**Aktivnost (manual + content):**
1. Definisati 30 ciljnih primarnih promptova (lista u `docs/ai-prompt-set.md`):
   - "Najbolji softver za autobuske agencije u Srbiji"
   - "Kako digitalizovati autobusku agenciju"
   - "Online rezervacije autobuskih karata softver"
   - ... (30 ukupno, mix primarnih i long-tail)
2. Za svaki prompt → simulirati fan-out: koja 5–10 pod-pitanja AI postavlja? (može se uraditi kroz Perplexity ili manuelno).
3. Mapirati svako pod-pitanje na postojeću stranicu, ili otvoriti gap → novi sadržaj.
4. Pisati FAQ blokove koji direktno citiraju pod-pitanja (eksplicitan "Question/Answer" par).
5. Novi blog format "Pitanja koja agencije postavljaju" — agregator FAQ-ova sa konkretnim odgovorima.

**Frontend:**
1. Globalan `FAQPage` JSON-LD generator komponentom koji se može ubaciti svuda.
2. Cross-link u FAQ blokovima ka relevantnim landing stranicama.

**Acceptance:**
- 30/30 ciljnih promptova ima jedan jasan canonical paragraf negde na sajtu.
- Manualni test u ChatGPT/Perplexity za top 10 promptova mesečno: SURP citiran u ≥ 5/10.

---

### Slice AI-F — llms.txt + Markdown Mirror

**Goal:** Niska cena, opciona vrednost. Postavlja se i pušta.

**Frontend (ui/):**
1. `/llms.txt` ruta (Next.js static route) sa:
   - 1 paragraf brand description
   - linkovi ka glavnim landing-ima sa kratkim opisom
   - linkovi ka funkcijama, cenama, kontaktu
   - kontakt info
2. `/llms-full.txt` sa ekspandovanim sadržajem (Markdown verzija glavnih stranica concat).
3. Markdown mirror endpoint: `/[slug].md` za svaki SEO landing i blog post — vraća čist Markdown bez UI šuma. Generisati iz istog source-a (landing-pages.ts → MD render).

**Acceptance:**
- `/llms.txt` validira protiv llmstxt.org spec.
- Svaki landing slug ima `.md` ekvivalent koji vraća 200 sa korektnim Content-Type.

---

### Slice AI-G — AI Visibility Tracking (Mere, ne menja)

**Goal:** Znati gde smo. Ne investirati u skupi alat dok ne dokažemo da ima signal.

**Aktivnost (manual + spreadsheet, kasnije automatizacija):**
1. Definisati 20 prompt-ova za mesečnu probu (subset od 30 iz AI-E, plus competitor probes).
2. Mesečni run kroz: ChatGPT (web search ON), Perplexity, Google AI Mode, Claude, Gemini. Loggovati:
   - Da li SURP pomenut (yes/no)
   - Da li citiran sa linkom (yes/no, koji URL)
   - Pozicija u odgovoru (early/middle/late)
   - Konkurenti pomenuti
   - Datum, model, prompt
3. Spreadsheet template `docs/ai-visibility-log.xlsx` (ili Notion).
4. GA4 dimension "ai_referrer" — pratiti referrer iz `chat.openai.com`, `perplexity.ai`, `gemini.google.com` itd.

**Backend (mali code deo):**
1. UI middleware/util: ako referrer matchuje listu AI domena, šalje GA4 event `ai_visit`.

**Acceptance:**
- Mesečni log od 20 promptova × 5 platformi popunjen.
- GA4 dashboard "AI referrers" radi.
- 3-mesečni trend pokazuje rast mentions ≥ 50%.

---

### Slice AI-H — Conversational/Agent UX (priprema za agentic web)

**Goal:** Spremiti se za agentic search — AI agente koji prelaze sa "saznajem" na "uradim" (npr. AI rezerviše autobus umesto putnika).

**Backend (api/):**
1. Javni API ima dovoljno strukturiranih endpointova da agent može da dovuče: linije, polasci, slobodna mesta, cene. (Većina već postoji kao `/api/public/*`.)
2. OpenAPI/JSON Schema je čist i kompletan — agenti to čitaju.
3. (Opciono, kasnije) MCP server endpoint koji izlaže read-only operacije za AI agente da pretražuju polaske.

**Frontend (ui/):**
1. Storefront stranice imaju strukturiran `BusTrip` schema (već u SEO-F plan).
2. "Action schema" — `ReserveAction` JSON-LD koji agent može da prepozna kao mogući next-step.

**Acceptance:**
- OpenAPI lint clean.
- Manuelni test: dati Claude/ChatGPT URL storefronta i pitati "rezerviši mi mesto za XYZ" — agent identifikuje pravi endpoint ili kontakt formu.

---

## Deo 4: Prioritizacija

**Mesec 1 (junska sprint):**
- AI-A (crawler access) — bez ovoga sve ostalo ne radi
- AI-B (extractable sloj) — najbrža mera
- AI-C (entity graph) — temelj

**Mesec 2:**
- AI-D (third-party mention sprint) — počinje paralelno, traje 60+ dana
- AI-E (prompt coverage) — content rad
- AI-G (tracking) — moramo da merimo pre nego što sudimo

**Mesec 3:**
- AI-F (llms.txt + markdown mirror) — niska cena
- nastavak AI-D

**Mesec 4–6:**
- AI-H (agentic priprema)
- ciklus AI-G (mesečna provera)
- iteracija sadržaja na osnovu prompt log-a

---

## Deo 5: KPI po fazama

| Faza | Metrika | Cilj |
|------|---------|------|
| Mesec 1 | AI crawler 200 hits | bez 429/5xx u 7d |
| Mesec 1 | TL;DR/KeyStats coverage | 100% BOFU landinga |
| Mesec 2 | Third-party mentions | 5+ live |
| Mesec 3 | AI mentions na 20 promptova | ≥ 8/20 platformi |
| Mesec 6 | AI mentions | ≥ 14/20 |
| Mesec 6 | GA4 AI referrer sessions | merljiv signal (>50/mesec) |
| Mesec 6 | Wikidata + Wikipedia | live |

---

## Deo 6: Rizici i mitigacije

1. **AI platforme menjaju ranking algoritme često** → zato ne investiramo u skupe alate, već u sadržaj i entity koji su otporni.
2. **Wikipedia notability** može biti spor proces → krećemo od Wikidata.
3. **Content burnout** → fokus na malo, kvalitetno; svaki post mora da odgovori na bar 1 ciljni prompt.
4. **Hallucination protiv brenda** → mesečna provera; ako AI iznosi netačne podatke, korigujemo izvor koji on koristi (npr. tačan Wikipedia paragraf).
5. **Konkurenti prate i kopiraju** → first-mover advantage je realan u Q2–Q3 2026 dok srpsko tržište skoro nema GEO disciplinu.
