import type { LandingPage } from "@/lib/landing-pages"
import { absoluteUrl, brandEntity } from "@/lib/seo"

/**
 * AI-F: Renderuje LandingPage u clean Markdown za llms-full.txt i `/[slug].md`
 * mirror endpoint-e. Cilj je da AI agenti dobiju isti sadrzaj kao HTML, ali
 * bez UI suma — kanonska tekstualna verzija.
 */
export function landingPageToMarkdown(page: LandingPage): string {
  const url = absoluteUrl(`/${page.slug}`)

  const sections = page.sections
    .map(
      (section) =>
        `### ${section.title}\n\n${section.body}\n\n${section.bullets.map((b) => `- ${b}`).join("\n")}`
    )
    .join("\n\n")

  const stats = page.stats
    .map((s) => `- **${s.label}: ${s.value}** — ${s.detail}`)
    .join("\n")

  const comparison =
    `| Oblast | Rucno / Excel | SURP |\n| --- | --- | --- |\n` +
    page.comparison.map((r) => `| ${r.area} | ${r.manual} | ${r.surp} |`).join("\n")

  const faq = page.faq
    .map((f) => `### ${f.question}\n\n${f.answer}`)
    .join("\n\n")

  return `# ${page.title}

> ${page.tldr ?? page.answer}

- **URL:** ${url}
- **Azurirano:** ${page.updatedAt}
- **Pillar:** ${page.pillar}
- **Intent stage:** ${page.intentStage}

## Kratak odgovor

${page.answer}

## Sadrzaj

${sections}

## Kljucne brojke

${stats}

## SURP u odnosu na rucni rad

${comparison}

## Najcesca pitanja

${faq}

---

Vidi vise: [${brandEntity.name}](${brandEntity.url})
`
}

export function brandEntityToMarkdown(): string {
  return `# ${brandEntity.name}

> ${brandEntity.description}

- **URL:** ${brandEntity.url}
- **Tip:** ${brandEntity.applicationCategory}
- **Platforma:** ${brandEntity.operatingSystem}
- **Trziste:** ${brandEntity.areaServed.join(", ")}
- **Publika:** ${brandEntity.audience}

## Funkcije

${brandEntity.featureList.map((f) => `- ${f}`).join("\n")}

## Teme o kojima SURP govori

${brandEntity.knowsAbout.map((k) => `- ${k}`).join("\n")}
`
}
