import type { Metadata } from "next"
import { BlogCard } from "@/components/marketing/blog-card"
import { MarketingSection } from "@/components/marketing/section"
import { getAllBlogPosts } from "@/lib/blog"
import { breadcrumbJsonLd, buildMetadata, jsonLd } from "@/lib/seo"

export const metadata: Metadata = buildMetadata({
  title: "Blog",
  description: "Saveti o digitalizaciji autobuskih agencija, online rezervacijama i boljem vodjenju linija.",
  path: "/blog",
})

export default function BlogPage() {
  const posts = getAllBlogPosts()
  const breadcrumbs = breadcrumbJsonLd([
    { name: "SURP", path: "/" },
    { name: "Blog", path: "/blog" },
  ])

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }} />
      <MarketingSection className="bg-[color:var(--mk-bg)]">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--mk-indigo-600)]">
            Blog
          </p>
          <h1 className="mt-4 font-display text-5xl font-bold tracking-[-0.035em] text-[color:var(--mk-navy-900)] md:text-6xl">
            Prakticni vodici za autobuske agencije.
          </h1>
          <p className="mt-6 text-lg leading-8 text-[color:var(--mk-text-muted)] md:text-xl">
            Pisemo o online rezervacijama, SEO-u, digitalizaciji operacija i
            procesima koji pomazu agencijama da rastu bez operativnog haosa.
          </p>
        </div>
      </MarketingSection>

      <MarketingSection className="bg-[color:var(--mk-bg-alt)] pt-0">
        {posts.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-[color:var(--mk-border)] bg-white p-8 text-center shadow-mk-sm">
            <h2 className="font-display text-2xl font-semibold text-[color:var(--mk-navy-900)]">
              Uskoro dolaze prvi clanci.
            </h2>
            <p className="mt-3 text-sm text-[color:var(--mk-text-muted)]">
              Pripremamo vodice o online rezervacijama, SEO-u i operacijama.
            </p>
          </div>
        )}
      </MarketingSection>
    </>
  )
}
