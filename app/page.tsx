"use client"

import { useState } from "react"
import { UploadForm } from "@/components/upload-form"
import { ReportView } from "@/components/report-view"
import type { ReportData } from "@/types/report"

export default function HomePage() {
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)

  return (
    <main className="min-h-screen">
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-semibold text-balance">OptiGen - Automated Report Generator</h1>
          <span className="text-sm text-muted-foreground">Gen AI + Optional Web Search</span>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-4 py-6">
        <UploadForm
          onStart={() => {
            setLoading(true)
            setReport(null)
            setErrorText(null)
          }}
          onError={(msg) => {
            setErrorText(msg)
            setLoading(false)
          }}
          onSuccess={(data) => {
            setReport(data)
            setLoading(false)
          }}
        />

        {loading && (
          <div className="mt-6 rounded-md border p-4 bg-muted">
            <p className="text-sm text-muted-foreground">Generating your report. This can take a minute...</p>
          </div>
        )}

        {errorText && (
          <div className="mt-6 rounded-md border p-4 bg-destructive/10">
            <p className="text-sm">Error: {errorText}</p>
          </div>
        )}

        {report && (
          <div className="mt-8">
            <ReportView report={report} />
          </div>
        )}
      </section>
    </main>
  )
}
