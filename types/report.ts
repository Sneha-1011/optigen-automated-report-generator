export type UploadedFileMeta = {
  filename: string
  mediaType?: string
}

export type TableSpec = {
  headers?: string[]
  rows?: string[][]
}

export type ChartSpec = {
  type: "line" | "bar" | "pie"
  title: string
  xKey: string
  yKeys: string[]
  data: Array<Record<string, string | number>>
}

export type Reference = {
  title?: string
  url?: string
  source?: string // e.g., filename
}

export type ReportSection = {
  heading: string
  paragraphs?: string[]
  table?: TableSpec
}

export type ReportData = {
  title: string
  tone: "neutral" | "formal" | "casual"
  generatedAt: string
  metadata?: {
    author?: string
    stakeholder?: string
    tags?: string[]
    files?: UploadedFileMeta[]
  }
  executiveSummary?: string
  sections: ReportSection[]
  charts?: ChartSpec[]
  references?: Reference[]
}
