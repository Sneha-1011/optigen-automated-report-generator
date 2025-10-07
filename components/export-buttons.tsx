"use client"

import { Button } from "@/components/ui/button"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import type { ReportData } from "@/types/report"
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx"

export function ExportButtons({ report }: { report: ReportData }) {
  async function exportPDF() {
    const node = document.getElementById("report-root")
    if (!node) return

    const canvas = await html2canvas(node, {
      scale: 2,
      useCORS: true, // crossOrigin: anonymous handled by browser if needed
    })
    const imgData = canvas.toDataURL("image/png")

    const pdf = new jsPDF("p", "pt", "a4")
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width

    let position = 0
    pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight)
    // Add more pages if content exceeds one page
    let heightLeft = pdfHeight - pdf.internal.pageSize.getHeight()
    while (heightLeft > 0) {
      pdf.addPage()
      position = heightLeft * -1
      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight)
      heightLeft -= pdf.internal.pageSize.getHeight()
    }

    pdf.save(`${report.title || "report"}.pdf`)
  }

  async function exportDOCX() {
    const children: Paragraph[] = []

    // Title
    children.push(new Paragraph({ text: report.title, heading: HeadingLevel.TITLE }))

    // Metadata
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Generated: ${new Date(report.generatedAt).toLocaleString()}`, size: 20 }),
          new TextRun({ text: ` • Tone: ${report.tone}`, size: 20 }),
        ],
      }),
    )

    if (report.metadata) {
      const md = report.metadata
      const mdLines: string[] = []
      if (md.author) mdLines.push(`Author: ${md.author}`)
      if (md.stakeholder) mdLines.push(`Stakeholder: ${md.stakeholder}`)
      if (md.tags?.length) mdLines.push(`Tags: ${md.tags.join(", ")}`)
      if (md.files?.length) mdLines.push(`Files: ${md.files.map((f) => f.filename).join(", ")}`)
      if (mdLines.length) {
        children.push(new Paragraph({ text: mdLines.join(" | "), spacing: { after: 200 } }))
      }
    }

    if (report.executiveSummary) {
      children.push(new Paragraph({ text: "Executive Summary", heading: HeadingLevel.HEADING_2 }))
      children.push(new Paragraph({ text: report.executiveSummary }))
    }

    if (report.sections?.length) {
      for (const sec of report.sections) {
        children.push(new Paragraph({ text: sec.heading, heading: HeadingLevel.HEADING_2 }))
        for (const p of sec.paragraphs || []) {
          children.push(new Paragraph({ text: p }))
        }
        if (sec.table && sec.table.rows?.length) {
          // Simple table-like lines for DOCX
          children.push(new Paragraph({ text: (sec.table.headers || []).join(" | "), spacing: { after: 100 } }))
          for (const row of sec.table.rows) {
            children.push(new Paragraph({ text: row.join(" | ") }))
          }
        }
      }
    }

    if (report.references?.length) {
      children.push(new Paragraph({ text: "References", heading: HeadingLevel.HEADING_2 }))
      for (const ref of report.references) {
        const line = `${ref.title ? ref.title + " — " : ""}${ref.url || ref.source || ""}`
        children.push(new Paragraph({ text: line }))
      }
    }

    const doc = new Document({ sections: [{ children }] })
    const blob = await Packer.toBlob(doc)

    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `${report.title || "report"}.docx`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="default" onClick={exportPDF}>
        Export PDF
      </Button>
      <Button variant="secondary" onClick={exportDOCX}>
        Export DOCX
      </Button>
      <Button
        variant="ghost"
        onClick={() => {
          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2))
          const a = document.createElement("a")
          a.href = dataStr
          a.download = `${report.title || "report"}.json`
          a.click()
        }}
      >
        Download JSON
      </Button>
    </div>
  )
}
