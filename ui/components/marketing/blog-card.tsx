import Link from "next/link"
import { ArrowRight } from "lucide-react"
import type { BlogPost } from "@/lib/blog"

type BlogCardProps = {
  post: Omit<BlogPost, "body">
}

export function BlogCard({ post }: BlogCardProps) {
  return (
    <article className="group overflow-hidden rounded-3xl border border-[color:var(--mk-border)] bg-white shadow-mk-sm transition duration-300 hover:-translate-y-1 hover:border-[color:var(--mk-indigo-100)] hover:shadow-mk-lg">
      <div className="relative flex h-44 items-end overflow-hidden bg-[linear-gradient(135deg,rgba(79,70,229,0.18),rgba(14,165,233,0.18))] p-6">
        <div className="absolute inset-0 opacity-[0.16] [background-image:radial-gradient(#0B1220_1px,transparent_1px)] [background-size:18px_18px]" />
        <span className="absolute -right-3 -top-8 font-display text-8xl font-bold tracking-[-0.08em] text-white/55">
          {post.cover.slice(0, 2).toUpperCase()}
        </span>
        <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--mk-indigo-600)] shadow-mk-sm">
          {post.cover}
        </span>
      </div>
      <div className="p-6">
        <div className="flex flex-wrap gap-2 text-xs font-medium text-[color:var(--mk-text-subtle)]">
          <span>{post.category}</span>
          <span>·</span>
          <time dateTime={post.date}>{formatDate(post.date)}</time>
          <span>·</span>
          <span>{post.readingTime}</span>
        </div>
        <h2 className="mt-4 font-display text-2xl font-semibold tracking-[-0.02em] text-[color:var(--mk-navy-900)]">
          <Link href={`/blog/${post.slug}`} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mk-indigo-600)] focus-visible:ring-offset-4">
            {post.title}
          </Link>
        </h2>
        <p className="mt-3 text-sm leading-6 text-[color:var(--mk-text-muted)]">{post.description}</p>
        <Link
          href={`/blog/${post.slug}`}
          className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--mk-indigo-600)] group-hover:underline"
        >
          Procitajte
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  )
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("sr-Latn-RS", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(date))
}
