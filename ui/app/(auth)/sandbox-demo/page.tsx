import type { Metadata } from "next"
import { SandboxDemoRedirect } from "@/components/auth/sandbox-demo-redirect"

export const metadata: Metadata = {
  title: "Sandbox demo - SURP",
  robots: {
    index: false,
    follow: false,
  },
}

export default function SandboxDemoPage() {
  return <SandboxDemoRedirect />
}
