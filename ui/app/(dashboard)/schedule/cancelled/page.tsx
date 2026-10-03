"use client"

import { Layout } from "@/components/layout/Layout"
import { CancelledDeparturesView } from "@/components/rides/CancelledDeparturesView"

export default function CancelledDeparturesPage() {
  return (
    <Layout>
      <CancelledDeparturesView />
    </Layout>
  )
}
