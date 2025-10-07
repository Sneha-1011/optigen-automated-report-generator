import type { NextRequest } from "next/server"
import { generateObject } from "ai"
import { z } from "zod"
import { searchSerp } from "@/lib/serp"
import { generateGroqReport } from "@/lib/groq"

// For CSV/Excel chart generation
import * as XLSX from "xlsx"
import Papa from "papaparse"

export const maxDuration = 60
export const runtime = "nodejs"

const ChartSchema = z.object({
  type: z.enum(["line", "bar", "pie"]),
  title: z.string(),
  xKey: z.string(),
  yKeys: z.array(z.string()).min(1),
  data: z.array(z.record(z.union([z.string(), z.number()]))).min(1),
})

const SectionSchema = z.object({
  heading: z.string(),
  paragraphs: z.array(z.string()).default([]),
  table: z
    .object({
      headers: z.array(z.string()).default([]),
      rows: z.array(z.array(z.string())).default([]),
    })
    .partial()
    .optional(),
})

const ReportSchema = z.object({
  title: z.string(),
  tone: z.enum(["neutral", "formal", "casual"]),
  generatedAt: z.string(),
  metadata: z
    .object({
      author: z.string().optional(),
      stakeholder: z.string().optional(),
      tags: z.array(z.string()).optional(),
      files: z.array(z.object({ filename: z.string(), mediaType: z.string().optional() })).optional(),
    })
    .optional(),
  executiveSummary: z.string().optional(),
  sections: z.array(SectionSchema).default([]),
  charts: z.array(ChartSchema).optional(),
  references: z
    .array(
      z.object({
        title: z.string().optional(),
        url: z.string().optional(),
        source: z.string().optional(),
      }),
    )
    .optional(),
})

function isGatewayBillingError(err: any) {
  const msg = String(err?.message || "")
  const body = String(err?.body || "")
  const type = err?.error?.type || ""
  return (
    msg.includes("customer_verification_required") ||
    msg.includes("AI Gateway requires a valid credit card") ||
    body.includes("customer_verification_required") ||
    type === "customer_verification_required" ||
    err?.status === 403
  )
}

async function readTextSnippets(files: File[], maxChars = 2000) {
  const allowedTypes = new Set([
    "text/plain",
    "text/markdown",
    "text/csv",
    "application/json",
  ]);
  let combined = "";

  for (const f of files) {
    try {
      if (allowedTypes.has(f.type) || f.name.match(/\.(txt|md|csv|json)$/i)) {
        const t = await f.text();
        if (t) {
          combined += (combined ? "\n\n---\n\n" : "") + t;
        }
      } else if (
        f.type ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        f.name.match(/\.docx$/i)
      ) {
        try {
          const JSZip = (await import("jszip")).default as any;
          const buf = Buffer.from(await f.arrayBuffer());
          const zip = await JSZip.loadAsync(buf);
          const entry = zip.file("word/document.xml");
          if (entry) {
            const xml = await entry.async("string");
            const text = xml
              .replace(/<w:p[^>]*>/g, "\n")
              .replace(/<[^>]+>/g, "")
              .replace(/[\t\r]+/g, " ")
              .replace(/\n\s+\n/g, "\n\n")
              .trim();
            if (text) {
              combined += (combined ? "\n\n---\n\n" : "") + text;
            }
          }
        } catch {}
      } else if (f.type === "application/pdf" || f.name.match(/\.pdf$/i)) {
        try {
          const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.js");
          pdfjs.GlobalWorkerOptions.workerSrc = undefined;
          const data = new Uint8Array(await f.arrayBuffer());
          const loadingTask = (pdfjs as any).getDocument({ data });
          const pdf = await loadingTask.promise;
          let pdfText = "";
          const maxPages = Math.min(pdf.numPages, 20);
          for (let i = 1; i <= maxPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const strings = (content.items || []).map((it: any) => it.str).filter(Boolean);
            if (strings.length) {
              pdfText += (pdfText ? "\n" : "") + strings.join(" ");
            }
            if (combined.length + pdfText.length >= maxChars) break;
          }
          if (pdfText) combined += (combined ? "\n\n---\n\n" : "") + pdfText;
        } catch {}
      }
    } catch {}
    if (combined.length >= maxChars) break;
  }

  return combined.slice(0, maxChars);
}

// ------------------- Chart Extraction -------------------
async function generateChartsFromFiles(files: File[]) {
  const charts: any[] = []

  for (const f of files) {
    try {
      let headers: string[] = []
      let tableRows: string[][] = []

      if (f.name.match(/\.csv$/i)) {
        const text = await f.text()
        const result = Papa.parse(text, { header: true, skipEmptyLines: true })
        const rows = result.data as Record<string, string | number>[]
        if (rows.length > 0) {
          headers = Object.keys(rows[0])
          tableRows = rows.map(r => headers.map(h => String(r[h])))
        }

      } else if (f.name.match(/\.(xls|xlsx)$/i)) {
        const buf = Buffer.from(await f.arrayBuffer())
        const workbook = XLSX.read(buf, { type: "buffer" })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, string | number>[]
        if (rows.length > 0) {
          headers = Object.keys(rows[0])
          tableRows = rows.map(r => headers.map(h => String(r[h])))
        }
      }

      if (headers.length > 1 && tableRows.length > 0) {
        const xKey = headers[0]
        const yKeys = headers.slice(1)
        const data = tableRows.map(row => {
          const obj: Record<string, string | number> = {}
          headers.forEach((h, i) => {
            const val = row[i]
            obj[h] = !isNaN(Number(val)) ? Number(val) : val
          })
          return obj
        })

        // Generate bar chart for first numeric column
        charts.push({ type: "bar", title: `${yKeys[0]} vs ${xKey}`, xKey, yKeys: [yKeys[0]], data })
        // Generate line chart for second numeric column if exists
        if (yKeys[1]) charts.push({ type: "line", title: `${yKeys[1]} vs ${xKey}`, xKey, yKeys: [yKeys[1]], data })
      }
    } catch {}
  }

  return charts
}
// --------------------------------------------------------

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const title = (form.get("title") as string) || "Automated Report"
  const tone = ((form.get("tone") as string) || "neutral") as "neutral" | "formal" | "casual"
  const webSearch = ((form.get("webSearch") as string) || "false") === "true"
  const files = form.getAll("files") as File[]
  if (!files || files.length === 0) return new Response("No files uploaded", { status: 400 })

  const fileParts = await Promise.all(
    files.map(async (f) => {
      const buf = await f.arrayBuffer()
      const bytes = new Uint8Array(buf)
      const base64 = Buffer.from(bytes).toString("base64")
      return {
        data: base64,
        mediaType: f.type || "application/octet-stream",
        filename: f.name || "document",
      }
    }),
  )

  const extractionSchema = z.object({
    suggestedTitle: z.string().optional(),
    author: z.string().optional(),
    stakeholder: z.string().optional(),
    tags: z.array(z.string()).optional(),
    executiveSummary: z.string(),
    sections: z.array(SectionSchema).min(1),
    charts: z.array(ChartSchema).optional(),
    suggestedSearchQueries: z.array(z.string()).optional(),
  })

  let extracted:
    | z.infer<typeof extractionSchema>
    | {
        suggestedTitle?: string
        author?: string
        stakeholder?: string
        tags?: string[]
        executiveSummary: string
        sections: z.infer<typeof SectionSchema>[]
        charts?: z.infer<typeof ChartSchema>[]
        suggestedSearchQueries?: string[]
        _fallback?: true
      }

  try {
    const result = await generateObject({
      model: "openai/gpt-5",
      schema: extractionSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are an assistant that extracts structured, accurate report content from the provided files and suggests charts when numeric/tabular data exists. 
Tone should be ${tone}. 
1) Provide executive summary.
2) Provide 3-6 sections with headings and paragraphs. Include tables when present.
3) If possible, extract numeric data and propose chart specs (line, bar, or pie).
4) Suggest 2-4 short web search queries that would add timely context or validation.
Only return JSON per schema.`,
            },
            ...fileParts.map((fp) => ({
              type: "file" as const,
              data: fp.data,
              mediaType: fp.mediaType,
              filename: fp.filename,
            })),
          ],
        },
      ],
      abortSignal: req.signal,
    })
    extracted = result.object
  } catch (e: any) {
    if (!isGatewayBillingError(e)) {}
    const textPreview = await readTextSnippets(files, 1500)
    extracted = {
      _fallback: true,
      suggestedTitle: title,
      executiveSummary:
        "AI-based extraction is unavailable in this preview environment. This fallback summary lists uploaded files and includes the first available text snippet for context.",
      sections: [
        {
          heading: "Document Overview",
          paragraphs: [
            `Uploaded files: ${files.map((f) => f.name).join(", ")}`,
            textPreview ? `Excerpt:\n${textPreview}` : "No plain-text excerpt available from the uploaded documents.",
          ],
        },
      ],
      charts: [],
      suggestedSearchQueries: title ? [title, "key takeaways", "summary"] : ["document summary", "key points"],
    }
  }

  let serpResults: Record<string, { title: string; link: string; snippet?: string }[]> = {}
  if (webSearch && extracted?.suggestedSearchQueries?.length) {
    serpResults = await searchSerp(extracted.suggestedSearchQueries, 5)
  }

  const composedReportPrompt = `
Compose a final report with these constraints:
- Title: Prefer the user's provided title, else use suggestedTitle.
- Include metadata, executive summary, 3-6 sections, and concise references.
- If web results are provided, integrate them with brief attributions and links.
- Do not invent facts; cite sources explicitly.
- Keep writing tone: ${tone}.
Return structured JSON only per schema.

Extracted (from files):
${JSON.stringify(
  {
    suggestedTitle: extracted?.suggestedTitle,
    author: extracted?.author,
    stakeholder: extracted?.stakeholder,
    tags: extracted?.tags,
    executiveSummary: extracted?.executiveSummary,
    sections: extracted?.sections,
    charts: extracted?.charts,
  },
  null,
  2,
)}

Web Search (SERP) Results:
${JSON.stringify(serpResults, null, 2)}
  `.trim()

  let finalReport: z.infer<typeof ReportSchema>
  const hasGroq = Boolean(process.env.GROQ_API_KEY)
  if (hasGroq) {
    try {
      const docText = await readTextSnippets(files, 20000)
      const serpFindings = Object.keys(serpResults || {}).length
        ? JSON.stringify(serpResults, null, 2)
        : undefined
      const groq = await generateGroqReport({ docText, serpFindings, tone, title })
      if (groq.ok && groq.report) {
        const refObjects = Array.isArray(groq.report.references)
          ? groq.report.references.slice(0, 8).map((r: any) => {
              if (typeof r === "string") return { title: r, url: r }
              return { title: r?.title, url: r?.url }
            })
          : []
        finalReport = {
          title: groq.report.title || title || extracted?.["suggestedTitle"] || "Automated Report",
          tone: (groq.report.tone as any) || tone,
          generatedAt: new Date().toISOString(),
          metadata: {
            ...(extracted?.tags ? { tags: extracted.tags } : {}),
            files: files.map((f) => ({ filename: f.name, mediaType: f.type })),
          },
          executiveSummary: groq.report.executiveSummary,
          sections: Array.isArray((groq.report as any).sections)
            ? (groq.report as any).sections.map((s: any) => ({
                heading: s.title || s.heading || "",
                paragraphs: s.content ? [s.content] : s.paragraphs || [],
              }))
            : [],
          charts: [],
          references: refObjects,
        }
      } else throw new Error("groq_failed")
    } catch {}
  }

  if (!finalReport) {
    try {
      const result = await generateObject({
        model: "openai/gpt-5",
        schema: ReportSchema,
        prompt: composedReportPrompt,
        maxOutputTokens: 3000,
        abortSignal: req.signal,
      })
      finalReport = result.object
    } catch (e: any) {
      const refs =
        Object.values(serpResults || {})
          .flat()
          .slice(0, 8)
          .map((r) => ({ title: r.title, url: r.link })) || []
      finalReport = {
        title: title || extracted?.["suggestedTitle"] || "Automated Report",
        tone,
        generatedAt: new Date().toISOString(),
        metadata: {
          ...(extracted?.tags ? { tags: extracted.tags } : {}),
          files: files.map((f) => ({ filename: f.name, mediaType: f.type })),
          ...(((extracted as any)?._fallback)
            ? { tags: [...(extracted?.tags || []), "ai-fallback"] }
            : {}),
        },
        executiveSummary:
          extracted?.["executiveSummary"] ||
          "This is a minimal report generated without external AI due to preview environment restrictions.",
        sections: (extracted?.["sections"] as any) || [],
        charts: (extracted?.["charts"] as any) || [],
        references: refs,
      }
    }
  }

  if (!finalReport) {
    finalReport = {
      title: title || "Automated Report",
      tone,
      generatedAt: new Date().toISOString(),
      sections: [],
      metadata: { files: files.map((f) => ({ filename: f.name, mediaType: f.type })) },
    } as any
  }

  finalReport.title = title || finalReport.title || "Automated Report"
  finalReport.tone = tone
  finalReport.generatedAt = new Date().toISOString()
  finalReport.metadata = {
    ...(finalReport.metadata || {}),
    files: files.map((f) => ({ filename: f.name, mediaType: f.type })),
  }

  // ------------------ Append CSV/Excel charts ------------------
  const chartsFromFiles = await generateChartsFromFiles(files)
  finalReport.charts = [...(finalReport.charts || []), ...chartsFromFiles]
  // -------------------------------------------------------------

  if (!webSearch && finalReport.references?.length) {
    finalReport.references = finalReport.references.map((r) => ({
      title: r.title,
      source: r.source,
    }))
  }

  return Response.json(finalReport)
}
