"use client"

import type React from "react"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"

type Props = {
  onStart: () => void
  onSuccess: (data: any) => void
  onError: (message: string) => void
}

export function UploadForm({ onStart, onSuccess, onError }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [webSearch, setWebSearch] = useState(false)
  const [topic, setTopic] = useState("")
  const [tone, setTone] = useState<"formal" | "casual" | "neutral">("neutral")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formRef.current) return
    const fd = new FormData(formRef.current)

    fd.set("webSearch", webSearch ? "true" : "false")
    fd.set("topic", topic)
    fd.set("tone", tone)

    try {
      onStart()
      const res = await fetch("/api/generate-report", {
        method: "POST",
        body: fd,
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || "Failed to generate report")
      }
      const data = await res.json()
      onSuccess(data)
    } catch (err: any) {
      onError(err?.message || "Failed to generate report")
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="rounded-xl border bg-gradient-to-b from-background to-muted/40 p-5 shadow-sm"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-2">Upload document</label>
          <input
            type="file"
            name="files"
            multiple
            className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent/30 transition-colors"
            aria-label="Upload document(s) for analysis"
            accept=".pdf,.doc,.docx,.txt,.csv,.md,.rtf,.json,.xlsx,.xls"
            required
          />
          <p className="text-xs text-muted-foreground mt-2">
            Supported: PDF, DOC/DOCX, TXT, CSV, Markdown, RTF, JSON, XLS/XLSX
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Report topic (optional)</label>
          <input
            type="text"
            name="title"
            placeholder="e.g., Compliance Summary Q3 2025"
            className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring/40 outline-none"
            onChange={(e) => setTopic(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Tone</label>
          <select
            className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring/40 outline-none"
            value={tone}
            onChange={(e) => setTone(e.target.value as any)}
          >
            <option value="neutral">Neutral</option>
            <option value="formal">Formal</option>
            <option value="casual">Casual</option>
          </select>
        </div>

        <div className="col-span-2 flex items-center gap-3">
          <input
            id="webSearch"
            type="checkbox"
            className="h-4 w-4 accent-foreground"
            checked={webSearch}
            onChange={(e) => setWebSearch(e.target.checked)}
          />
          <label htmlFor="webSearch" className="text-sm">
            Enable external web search (requires server SERP_API_KEY)
          </label>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" className="shadow-sm">Generate Report</Button>
        <span className="text-xs text-muted-foreground">
          We will analyze your document and optionally include web findings with citations.
        </span>
      </div>
    </form>
  )
}
