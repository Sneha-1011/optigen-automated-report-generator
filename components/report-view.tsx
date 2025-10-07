"use client"

import type { ReportData } from "@/types/report"
import { ExportButtons } from "@/components/export-buttons"
import { ChartRenderer } from "@/components/charts/chart-renderer"

type Props = {
  report: ReportData
}

export function ReportView({ report }: Props) {
  return (
    <article id="report-root" className="rounded-xl border bg-gradient-to-b from-background to-muted/40 p-5 shadow-sm">
      <header className="mb-6">
        <h2 className="text-2xl font-semibold text-balance tracking-tight">{report.title}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Generated: {new Date(report.generatedAt).toLocaleString()} • Tone: {report.tone}
        </p>
        {report.metadata && (
          <dl className="mt-3 grid gap-2 text-sm">
            {report.metadata.author && (
              <div>
                <span className="text-muted-foreground">Author:</span> {report.metadata.author}
              </div>
            )}
            {report.metadata.stakeholder && (
              <div>
                <span className="text-muted-foreground">Stakeholder:</span> {report.metadata.stakeholder}
              </div>
            )}
            {report.metadata.tags?.length ? (
              <div>
                <span className="text-muted-foreground">Tags:</span> {report.metadata.tags.join(", ")}
              </div>
            ) : null}
            {report.metadata.files?.length ? (
              <div>
                <span className="text-muted-foreground">Files:</span>{" "}
                {report.metadata.files.map((f) => f.filename).join(", ")}
              </div>
            ) : null}
          </dl>
        )}
      </header>

      {report.executiveSummary && (
        <section className="mb-6">
          <h3 className="text-lg font-medium">Executive Summary</h3>
          <p className="mt-2 text-pretty leading-relaxed">{report.executiveSummary}</p>
        </section>
      )}

      {report.sections?.length ? (
        <section className="mb-6 space-y-6">
          {report.sections.map((sec, idx) => (
            <div key={idx} className="rounded-md border p-3 bg-background">
              <h4 className="text-base font-semibold">{sec.heading}</h4>
              {sec.paragraphs?.map((p, i) => (
                <p className="mt-2 text-pretty leading-relaxed" key={i}>
                  {p}
                </p>
              ))}
              {sec.table && sec.table.rows?.length ? (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm border border-border rounded">
                    <thead className="bg-muted">
                      <tr>
                        {sec.table.headers?.map((h, i) => (
                          <th key={i} className="text-left px-3 py-2 border-b border-border">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sec.table.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="even:bg-muted/40">
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="px-3 py-2 border-b border-border">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {report.charts?.length ? (
        <section className="mb-6 space-y-6">
          <h3 className="text-lg font-medium">Visualizations</h3>
          {report.charts.map((chart, idx) => (
            <div key={idx} className="rounded-md border p-3 bg-background">
              <p className="text-sm font-medium mb-2">{chart.title}</p>
              <ChartRenderer spec={chart} />
            </div>
          ))}
        </section>
      ) : null}

      {report.references?.length ? (
        <section className="mt-8">
          <h3 className="text-lg font-medium">References</h3>
          <ul className="mt-2 list-disc pl-6 text-sm leading-relaxed">
            {report.references.map((ref, i) => (
              <li key={i}>
                {ref.title ? `${ref.title} — ` : ""}
                {ref.url ? (
                  <a className="underline" href={ref.url} target="_blank" rel="noreferrer">
                    {ref.url}
                  </a>
                ) : (
                  ref.source
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="mt-8">
        <ExportButtons report={report} />
      </footer>
    </article>
  )
}
