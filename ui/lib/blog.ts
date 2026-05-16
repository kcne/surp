import fs from "node:fs"
import path from "node:path"

const BLOG_DIR = path.join(process.cwd(), "content", "blog")

export type BlogPost = {
  slug: string
  title: string
  description: string
  date: string
  category: string
  cover: string
  readingTime: string
  body: string
}

type BlogPostMeta = Omit<BlogPost, "body">

export function getAllBlogPosts(): BlogPostMeta[] {
  return getBlogSlugs()
    .map((slug) => {
      const post = getBlogPost(slug)
      return {
        slug: post.slug,
        title: post.title,
        description: post.description,
        date: post.date,
        category: post.category,
        cover: post.cover,
        readingTime: post.readingTime,
      }
    })
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
}

export function getBlogPost(slug: string): BlogPost {
  const filePath = path.join(BLOG_DIR, `${slug}.md`)

  if (!fs.existsSync(filePath)) {
    throw new Error(`Blog post not found: ${slug}`)
  }

  const raw = fs.readFileSync(filePath, "utf8")
  const { frontmatter, body } = parseMarkdownFile(raw)

  return {
    slug,
    title: requiredFrontmatter(frontmatter, "title", slug),
    description: requiredFrontmatter(frontmatter, "description", slug),
    date: requiredFrontmatter(frontmatter, "date", slug),
    category: requiredFrontmatter(frontmatter, "category", slug),
    cover: frontmatter.cover ?? "SURP",
    readingTime: estimateReadingTime(body),
    body,
  }
}

export function getBlogSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) {
    return []
  }

  return fs
    .readdirSync(BLOG_DIR)
    .filter((file) => file.endsWith(".md"))
    .map((file) => file.replace(/\.md$/, ""))
}

function parseMarkdownFile(raw: string) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)

  if (!match) {
    return {
      frontmatter: {} as Record<string, string>,
      body: raw.trim(),
    }
  }

  const frontmatter = Object.fromEntries(
    match[1]
      .split("\n")
      .map((line) => {
        const separatorIndex = line.indexOf(":")
        if (separatorIndex === -1) {
          return null
        }

        const key = line.slice(0, separatorIndex).trim()
        const value = line
          .slice(separatorIndex + 1)
          .trim()
          .replace(/^"|"$/g, "")

        return [key, value]
      })
      .filter((entry): entry is [string, string] => Boolean(entry))
  )

  return {
    frontmatter,
    body: match[2].trim(),
  }
}

function requiredFrontmatter(frontmatter: Record<string, string>, key: string, slug: string) {
  const value = frontmatter[key]

  if (!value) {
    throw new Error(`Missing "${key}" frontmatter for blog post: ${slug}`)
  }

  return value
}

function estimateReadingTime(body: string) {
  const words = body.split(/\s+/).filter(Boolean).length
  const minutes = Math.max(1, Math.ceil(words / 220))
  return `${minutes} min citanja`
}
