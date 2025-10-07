export type SerpResult = {
  title: string
  link: string
  snippet?: string
}

export async function searchSerp(queries: string[], maxPerQuery = 5): Promise<Record<string, SerpResult[]>> {
  const apiKey = process.env.SERP_API_KEY
  if (!apiKey) {
    console.log("[v0] SERP_API_KEY missing; skipping external search.")
    return {}
  }

  const results: Record<string, SerpResult[]> = {}
  for (const q of queries) {
    try {
      const url = new URL("https://serpapi.com/search.json")
      url.searchParams.set("engine", "google")
      url.searchParams.set("q", q)
      url.searchParams.set("num", String(maxPerQuery))
      url.searchParams.set("api_key", apiKey)

      const res = await fetch(url.toString(), { method: "GET", cache: "no-store" })
      if (!res.ok) {
        console.log("[v0] SERP error", q, res.status)
        continue
      }
      const data = await res.json()
      const items = (data.organic_results || []).slice(0, maxPerQuery).map((it: any) => ({
        title: it.title,
        link: it.link,
        snippet: it.snippet,
      }))
      results[q] = items
    } catch (e: any) {
      console.log("[v0] SERP fetch failed", q, e?.message)
    }
  }
  return results
}
