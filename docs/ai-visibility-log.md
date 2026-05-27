# SURP AI Visibility Log

> Slice AI-G. Mesecni log manuelnih probnih upita kroz glavne AI search
> platforme. **Cilj nije savrsenstvo,** vec stabilan signal trenda kroz
> 6+ meseci pre nego sto investiramo u placeni alat.
>
> Vidi: [`docs/ai-prompt-set.md`](ai-prompt-set.md) za listu od 30
> promptova. Za mesecni log koristi subset od 20 (top promptovi +
> competitor probes).

## Procedura

1. Za svaki prompt → otvori sve 5 platforme **u istom prozoru** istog dana.
   - ChatGPT (web search ON, GPT najnoviji)
   - Perplexity (default model)
   - Google AI Mode (sr-RS lokalizacija)
   - Claude (sa web search-om kad je dostupno)
   - Gemini (default)
2. Za svaki rezultat zabelezi:
   - `pomenut`: yes / no
   - `citiran`: yes (sa linkom) / no
   - `pozicija`: early / middle / late / not-present
   - `konkurenti`: lista konkurencije koja je pomenuta
3. Ne menjaj prompt formulaciju iz meseca u mesec — komparabilnost.
4. Log u tabeli ispod, jedan red po (prompt, platforma, mesec).

## Subset od 20 promptova za mesecnu probu

Vidi `ai-prompt-set.md` brojeve: **1, 2, 3, 4, 5, 6, 7, 8, 11, 13, 14, 15, 16, 17, 19, 22, 23, 26, 27, 30**.

Plus 3 competitor probes:
- "Koje su alternativa za SURP u Srbiji"
- "Bus reservation software Serbia"
- "Autobuska agencija digitalizacija primer"

## Mesecni log

### 2026-06 (baseline pre AI-A/B/C deploy efekta — nista jos)

| Prompt # | Platforma | Pomenut | Citiran | Pozicija | Konkurenti | Beleska |
|----------|-----------|---------|---------|----------|------------|---------|
| _Popunjavam posle prvog probnog run-a._ | | | | | | |

### Sablon za mesec

Kopiraj blok ispod i menjaj datum:

```markdown
### YYYY-MM

| Prompt # | Platforma | Pomenut | Citiran | Pozicija | Konkurenti | Beleska |
|----------|-----------|---------|---------|----------|------------|---------|
| 1 | chatgpt | | | | | |
| 1 | perplexity | | | | | |
| 1 | google-ai | | | | | |
| 1 | claude | | | | | |
| 1 | gemini | | | | | |
```

## Mesecni summary

| Mesec | # mentions / 100 (20 × 5) | # citations | Trend |
|-------|---------------------------|-------------|-------|
| 2026-06 | _baseline_ | | |
| 2026-07 | | | |
| 2026-08 | | | |
| 2026-09 | | | |

## GA4 tracking

Posebno, `ai_visit` event se salje iz `ui/components/analytics/ai-referrer-analytics.tsx`
kad referrer poklopi listu AI domena. Dashboard u GA4:

- **Event:** `ai_visit`
- **Custom dimensions:** `ai_source`, `landing_path`
- **Suggested report:** Sessions × ai_source × landing_path (mesecni segment)

Cilj (mesec 6): `>50 sessions/mesec` sa `ai_visit` eventom.

## Alat odluka

- **Sad:** manuelni log + GA4. Bez placenog alata.
- **Re-evaluacija:** mesec 4. Ako mentions trend > 50% rast i timu treba manje
  vremena za log, razmotri Semrush AI Visibility Toolkit ili Profound.
- **Slucaj Lorelight (nov 2025):** GEO tracking startup-i su volatilni; ne ulazi
  u dugorocan ugovor pre nego sto imas baseline.
