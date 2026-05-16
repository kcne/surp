export function MarkdownContent({ body }: { body: string }) {
  const blocks = body.split(/\n{2,}/)

  return (
    <div className="mx-auto max-w-[68ch] space-y-7">
      {blocks.map((block, index) => {
        if (block.startsWith("## ")) {
          return (
            <h2 key={index} className="pt-8 font-display text-3xl font-semibold tracking-[-0.025em] text-[color:var(--mk-navy-900)]">
              {block.replace(/^## /, "")}
            </h2>
          )
        }

        if (block.startsWith("- ")) {
          return (
            <ul key={index} className="space-y-3">
              {block.split("\n").map((item) => (
                <li key={item} className="flex gap-3 text-base leading-8 text-[color:var(--mk-text-muted)]">
                  <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-[color:var(--mk-indigo-600)]" />
                  <span>{item.replace(/^- /, "")}</span>
                </li>
              ))}
            </ul>
          )
        }

        return (
          <p key={index} className="text-base leading-8 text-[color:var(--mk-text-muted)]">
            {block}
          </p>
        )
      })}
    </div>
  )
}
