import { MarketingFooter } from "@/components/marketing/footer"
import { MarketingNav } from "@/components/marketing/nav"

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[color:var(--mk-bg)] text-[color:var(--mk-text)]">
      <MarketingNav />
      <main id="main">{children}</main>
      <MarketingFooter />
    </div>
  )
}
