import { cn } from "@/lib/utils"

type MarketingSectionProps = {
  id?: string
  children: React.ReactNode
  className?: string
  containerClassName?: string
}

export function MarketingSection({
  id,
  children,
  className,
  containerClassName,
}: MarketingSectionProps) {
  return (
    <section id={id} className={cn("scroll-mt-24 py-20 md:py-28", className)}>
      <div className={cn("mx-auto w-full max-w-7xl px-6 md:px-8 lg:px-12", containerClassName)}>
        {children}
      </div>
    </section>
  )
}
