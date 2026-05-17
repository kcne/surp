# SURP Marketing UI Polish — One-Slice Execution Plan

> Cilj: završni vizuelni polish za postojeći marketing sajt tako da deluje kao moderan startup/SaaS landing u rangu Linear / Vercel / Resend / Cal.com estetike, bez novih velikih dependency-ja i bez narušavanja performance-a.

## 0. Scope

Ovaj slice ne menja routing, SEO strategiju, blog model, API lead endpoint ili pravne tekstove. Fokus je isključivo završni **visual/interaction polish** nad već implementiranim marketing stranama:

- `/`
- `/funkcije`
- `/cene`
- `/za-agencije`
- `/blog`
- `/blog/[slug]`
- `/kontakt`
- legal + 404

## 1. Trenutno stanje — audit

Već postoji dobra osnova:

- Hero ima ambient glow + dotted grid.
- H1 ima gradient highlight na “jednom mestu”.
- Feature grid je delimično bento.
- Dark CTA i dark spotlight postoje.
- Pricing Pro plan je istaknut.
- Testimonial cards imaju blagu rotaciju.
- SVG favicon, apple icon i OG fallback postoje.
- Nema stock fotografija i nema generic ilustracija.

Glavni nedostaci pre finalnog polish-a:

- Primarni CTA nema pravi animated gradient border pattern.
- Logo strip je dupliran, ali nije marquee/auto-scroll.
- “Live” detalji su statični; nema pulse dot, metric strip ili mikro indikator.
- Dark sekcije imaju dotted grid, ali ne i noise/gradient divider layer.
- Bento kartice nemaju dovoljno različitih vizuelnih focal point-a.
- Sekcije nemaju zajednički “premium surface” helper za inset highlight.
- Mobile polish treba proći ručno: hero dashboard kartica može biti pregusta na 360px.
- Blog kartice su funkcionalne, ali mogu dobiti jači editorial SaaS vibe.

## 2. Visual target

Izgled treba da bude:

- **tech-forward**, ali ne crypto/neon;
- **B2B ozbiljan**, ali ne enterprise-dosadan;
- **transport-relevantan**, ali bez autobus stock fotografija;
- **premium startup**, sa detaljima koji se vide tek na drugi pogled.

Ključna vizuelna rečenica:

> Deep navy operational SaaS canvas + indigo/sly blue signal accents + frosted dashboard surfaces + bento product storytelling.

## 3. Implementacioni plan

### 3.1 Dodati shared polish utility-je

Fajlovi:

- `ui/app/globals.css`
- `ui/tailwind.config.ts`
- opcionalno `ui/components/marketing/polish.tsx`

Dodati:

1. `animate-marquee`
2. `animate-gradient-border`
3. `animate-pulse-soft`
4. reusable CSS klase:
   - `.mk-surface`
   - `.mk-surface-dark`
   - `.mk-grid-bg`
   - `.mk-noise-bg`
   - `.mk-gradient-ring`

Primer klase:

```css
.mk-surface {
  border: 1px solid var(--mk-border);
  background: rgba(255,255,255,.86);
  box-shadow: var(--mk-shadow-sm), inset 0 1px 0 rgba(255,255,255,.72);
}
```

Acceptance:

- nema inline dupliranja za noise/grid/ring u više komponenti;
- `prefers-reduced-motion` i dalje gasi animacije;
- postojeći Tailwind build prolazi.

### 3.2 Hero polish

Fajl:

- `ui/components/marketing/hero.tsx`

Promene:

1. Primarni CTA pretvoriti u gradient ring dugme:
   - wrapper `p-[1px] rounded-full bg-[linear-gradient(...)] bg-[length:200%_200%] animate-gradient-border`
   - inner button ostaje solid indigo.
2. Dodati “Live demo” micro-badge u hero trust area:
   - zeleni pulse dot
   - tekst: `Live demo flow`
3. Hero dashboard mock:
   - dodati top browser chrome row (3 dots + URL chip `surp.app/dashboard`)
   - dodati mini sparkline/occupancy bar u desnom gornjem delu
   - na mobile smanjiti grid u karticama da ne bude prenatrpano.
4. Ambient glow:
   - dodati drugi manji sky glow u donji levi deo hero-a.

Acceptance:

- hero i dalje ima samo jedan H1;
- CTA touch target ≥ 48px;
- na 360px nema horizontalnog scroll-a;
- visual hierarchy ostaje: eyebrow → H1 → lead → CTA → trust.

### 3.3 Logo strip marquee

Fajl:

- `ui/components/marketing/logo-bar.tsx`

Promene:

1. Pretvoriti postojeći statični duplirani strip u pravi marquee:
   - `animate-marquee`
   - `hover:[animation-play-state:paused]`
   - `motion-reduce:animate-none`
2. Logo pills:
   - grayscale-like neutral state
   - hover: `text-mk-navy-900`, subtle indigo border
3. Dodati `aria-hidden` na dupliranu listu ili adekvatan semantic wrapper da screen reader ne čita duplikate.

Acceptance:

- marquee ne utiče na CLS;
- `prefers-reduced-motion` prikazuje statičan strip;
- fade mask ostaje.

### 3.4 Bento feature cards — stronger focal points

Fajl:

- `ui/components/marketing/features-grid.tsx`

Promene:

Svaka kartica dobija drugačiji focal point:

1. **Linije i stanice** — postojeća route mini-map se proširuje u veću visual zonu.
2. **Vozni redovi** — mini weekly schedule grid.
3. **Rezervacije** — seat occupancy chips / progress.
4. **Putnici** — stacked avatar/list rows.
5. **Javni sajt agencije** — mini storefront preview card.
6. **Izveštaji** — sparkline/bar chart.

Cards:

- dodati inset highlight;
- za veliku karticu koristiti `lg:col-span-2 lg:row-span-2`;
- široka kartica ostaje `lg:col-span-2`;
- hover: translateY(-4px), shadow-lg, border indigo tint.

Acceptance:

- bento nije uniformni “ikonica + tekst” grid;
- svaka kartica ima product storytelling vizual;
- mobile redosled ostaje logičan.

### 3.5 Dark sections — noise + gradient separator

Fajlovi:

- `ui/components/marketing/feature-spotlight.tsx`
- `ui/components/marketing/cta-band.tsx`
- `ui/app/(marketing)/za-agencije/page.tsx`

Promene:

1. Dodati `.mk-noise-bg` overlay dark sekcijama.
2. Dodati tanku gradient liniju na vrhu dark sekcija:
   - transparent → indigo/sky → transparent
3. Spotlight mock kartice u dark sekciji:
   - više glass/frosted efekta;
   - border white/10;
   - subtle glow iza kartice.

Acceptance:

- dark sekcije ne izgledaju flat;
- kontrast ostaje WCAG AA;
- noise je suptilan, ne “prljav”.

### 3.6 Pricing polish

Fajl:

- `ui/components/marketing/pricing-cards.tsx`

Promene:

1. Pro kartica dobija animated gradient border wrapper.
2. “Najpopularniji” badge dobija sparkle dot + blagi glow.
3. Dodati mini trust line ispod CTA:
   - `Bez ugovorne obaveze za demo`
4. Pricing cards dobiti consistent minimum height za desktop.

Acceptance:

- Pro je jasno primaran, ali ne previše agresivan;
- sve tri kartice deluju kao isti sistem;
- mobile ne scale-uje Pro karticu.

### 3.7 Blog editorial polish

Fajlovi:

- `ui/components/marketing/blog-card.tsx`
- `ui/app/(marketing)/blog/[slug]/page.tsx`

Promene:

1. Blog card cover postaje editorial tile:
   - category badge;
   - large decorative word/initial;
   - subtle dotted/gradient pattern.
2. Detail page hero dobija bolji article masthead:
   - category/date/reading time pill;
   - “SURP Insights” mini label;
   - larger cover tile with diagonal gradient.
3. Markdown content:
   - bolji spacing između H2;
   - `max-w-[68ch]`;
   - list bullets kao indigo dots već postoje, fino podesiti.

Acceptance:

- blog ne izgleda kao placeholder;
- article detail deluje kao publishing surface, ne običan markdown dump.

### 3.8 Contact form polish

Fajl:

- `ui/components/marketing/contact/demo-form.tsx`

Promene:

1. Input focus state ujednačiti sa brand ring-om.
2. Dodati helper microcopy ispod select-a:
   - `Gruba procena je dovoljna za prvi razgovor.`
3. Success state:
   - dodati check icon;
   - ako je success, CTA tekst ostaje disabled samo dok pending, ne posle.
4. Desna dark card na `/kontakt` dobija noise/gradient line.

Acceptance:

- forma deluje premium, ali ostaje jasna;
- error/success stanja su vidljiva i pristupačna;
- nema layout shift-a pri status poruci.

### 3.9 404 + legal consistency

Fajlovi:

- `ui/app/(marketing)/not-found.tsx`
- `ui/components/marketing/legal-page.tsx`

Promene:

1. 404 dobija isti gradient CTA button kao hero.
2. Legal page aside dobija mini table-of-contents linkove ka sekcijama.
3. Legal “radna verzija” warning dobija bolji neutral/amber surface.

Acceptance:

- legal strane ne deluju nedovršeno;
- 404 je deo istog marketing sistema.

## 4. Out of scope

Ne raditi u ovom slice-u:

- framer-motion dependency;
- real screenshots;
- A/B testing;
- i18n;
- Cal.com embed;
- real logo klijenata;
- email/CRM integraciju;
- izmene backend API-ja.

## 5. File checklist

Obavezni fajlovi za izmenu:

- `ui/app/globals.css`
- `ui/tailwind.config.ts`
- `ui/components/marketing/hero.tsx`
- `ui/components/marketing/logo-bar.tsx`
- `ui/components/marketing/features-grid.tsx`
- `ui/components/marketing/feature-spotlight.tsx`
- `ui/components/marketing/cta-band.tsx`
- `ui/components/marketing/pricing-cards.tsx`
- `ui/components/marketing/blog-card.tsx`
- `ui/components/marketing/markdown-content.tsx`
- `ui/components/marketing/contact/demo-form.tsx`
- `ui/components/marketing/legal-page.tsx`
- `ui/app/(marketing)/not-found.tsx`

Opcioni fajl:

- `ui/components/marketing/polish.tsx` ako se izdvoje reusable visual wrappers.

## 6. Validation

Run:

```bash
cd ui
rm -rf .next
pnpm lint
pnpm build
```

Manual QA:

1. `/` desktop 1440px — hero, bento, dark sections, pricing.
2. `/` mobile 360px — bez horizontalnog scroll-a.
3. `/blog` i jedan `/blog/[slug]` — editorial layout.
4. `/kontakt` — form focus, pending, success/error.
5. `/cene` — pricing Pro highlight i tabela.
6. `prefers-reduced-motion` — marquee/gradient animacije ne ometaju.

## 7. Done criteria

Slice je gotov kada:

- sajt vizuelno više nema “placeholder” zone;
- hero i bento sekcije nose najjači startup vibe;
- pricing, blog i contact deluju kao isti design system;
- dark sekcije imaju depth/noise/glow bez narušavanja čitljivosti;
- Lighthouse/performance nije degradiran novim efektima;
- `pnpm lint && pnpm build` prolazi.
