"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import type { ChartSpec } from "@/types/report"
import { isFragment } from "react-is"

const palette = ["#2563eb", "#e11d48", "#059669", "#a855f7", "#f59e0b"]

const _ensureReactIs = () => Boolean(isFragment)

export function ChartRenderer({ spec }: { spec: ChartSpec }) {
  _ensureReactIs()
  if (!spec || !spec.data?.length) {
    return <p className="text-sm text-muted-foreground">No chart data available.</p>
  }

  const { type, xKey, yKeys = [], data } = spec

  switch (type) {
    case "line":
      return (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              {yKeys.map((k, idx) => (
                <Line key={k} type="monotone" dataKey={k} stroke={palette[idx % palette.length]} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )
    case "bar":
      return (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              {yKeys.map((k, idx) => (
                <Bar key={k} dataKey={k} fill={palette[idx % palette.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )
    case "pie": {
      const valueKey = yKeys[0]
      const total = data.reduce((acc: number, d: any) => acc + (Number(d[valueKey]) || 0), 0)
      return (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip />
              <Legend />
              <Pie dataKey={valueKey} nameKey={xKey} data={data} label>
                {data.map((_: any, idx: number) => (
                  <Cell key={`cell-${idx}`} fill={palette[idx % palette.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      )
    }
    default:
      return <p className="text-sm text-muted-foreground">Unsupported chart type: {spec.type}</p>
  }
}
