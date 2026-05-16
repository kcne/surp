import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { CtaBand } from "@/components/marketing/cta-band"
import { formatDate } from "@/components/marketing/blog-card"
import { MarkdownContent } from "@/components/marketing/markdown-content"
import { MarketingSection } from "@/components/marketing/section"
import { getAllBlogPosts, getBlogPost, getBlogSlugs } from "@/lib/blog"
import { absoluteUrl, breadcrumbJsonLd, buildMetadata, jsonLd, siteConfig } from "@/lib/seo"

type BlogPostPageProps = {
  params: {
    slug: string
  }
}

export function generateStaticParams() {
  return getBlogSlugs().map((slug) => ({ slug }))
}

export function generateMetadata({ params }: BlogPostPageProps): Metadata {
  const post = safeGetPost(params.slug)

  if (!post) {
    return buildMetadata({
      title: "Blog",
      description: siteConfig.description,
      path: "/blog",
    })
  }

  return buildMetadata({
    title: post.title,
    description: post.description,
    path: `/blog/${post.slug}`,
  })
}

export default function BlogPostPage({ params }: BlogPostPageProps) {
  const post = safeGetPost(params.slug)

  if (!post) {
    notFound()
  }

  const relatedPosts = getAllBlogPosts().filter((item) => item.slug !== post.slug).slice(0, 2)
  const breadcrumbs = breadcrumbJsonLd([
    { name: "SURP", path: "/" },
    { name: "Blog", path: "/blog" },
    { name: post.title, path: `/blog/${post.slug}` },
  ])
  const blogPosting = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: {
      "@type": "Organization",
      name: siteConfig.name,
    },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
    },
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(blogPosting) }} />
      <MarketingSection className="bg-[color:var(--mk-bg)]">
        <article className="mx-auto max-w-3xl">
          <Link href="/blog" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--mk-indigo-600)] hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Nazad na blog
          </Link>
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mk-indigo-600)]">
            SURP Insights
          </p>
          <div className="inline-flex flex-wrap gap-2 rounded-full border border-[color:var(--mk-border)] bg-white px-4 py-2 text-xs font-medium text-[color:var(--mk-text-subtle)] shadow-mk-sm">
            <span>{post.category}</span>
            <span>·</span>
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span>·</span>
            <span>{post.readingTime}</span>
          </div>
          <h1 className="mt-5 font-display text-5xl font-bold tracking-[-0.035em] text-[color:var(--mk-navy-900)] md:text-6xl">
            {post.title}
          </h1>
          <p className="mt-6 text-lg leading-8 text-[color:var(--mk-text-muted)] md:text-xl">{post.description}</p>
          <div className="relative mt-10 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,rgba(79,70,229,0.2),rgba(14,165,233,0.16))] p-10 shadow-mk-sm">
            <div className="absolute inset-0 opacity-[0.16] [background-image:radial-gradient(#0B1220_1px,transparent_1px)] [background-size:22px_22px]" />
            <span className="absolute -right-6 -top-12 font-display text-9xl font-bold tracking-[-0.08em] text-white/60">
              {post.cover.slice(0, 2).toUpperCase()}
            </span>
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--mk-indigo-600)]">
              {post.cover}
            </span>
          </div>
          <div className="mt-12">
            <MarkdownContent body={post.body} />
          </div>
        </article>
      </MarketingSection>

      {relatedPosts.length > 0 ? (
        <MarketingSection className="bg-[color:var(--mk-bg-alt)]">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-display text-3xl font-semibold tracking-[-0.025em] text-[color:var(--mk-navy-900)]">
              Nastavite citanje
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {relatedPosts.map((item) => (
                <Link key={item.slug} href={`/blog/${item.slug}`} className="rounded-2xl border border-[color:var(--mk-border)] bg-white p-5 shadow-mk-sm transition hover:-translate-y-0.5 hover:shadow-mk-md">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--mk-indigo-600)]">{item.category}</p>
                  <h3 className="mt-3 font-display text-xl font-semibold text-[color:var(--mk-navy-900)]">{item.title}</h3>
                </Link>
              ))}
            </div>
          </div>
        </MarketingSection>
      ) : null}
      <CtaBand />
    </>
  )
}

function safeGetPost(slug: string) {
  try {
    return getBlogPost(slug)
  } catch {
    return null
  }
}
