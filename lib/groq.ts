// Uses Groq's OpenAI-compatible chat completions API.
// Note: This runs server-side only. Do not expose the API key to the client.

type GroqOptions = {
  docText: string
  serpFindings?: string
  tone?: string
  title?: string
}

function buildPrompt({ docText, serpFindings, tone = "neutral", title = "Automated Report" }: GroqOptions) {
  const serpBlock = serpFindings ? `External Web Search Findings (optional):\n${serpFindings}\n\n` : ""
  const trimmed = docText?.slice(0, 60000) || "" // allow larger context for grounding
  return [
    {
      role: "system",
      content:
        "You are an expert analyst that MUST ground every statement strictly in the provided Document Text. Do NOT add generic industry boilerplate. If information is not present, write 'Not found in document'. Prefer direct quotes with minimal paraphrase. Keep tone consistent and avoid hallucinations; only use web findings if provided, and cite separately.",
    },
    {
      role: "user",
      content:
        `Title: ${title}\nTone: ${tone}\n\n` +
        serpBlock +
        `Document Text (may be truncated; includes page markers when available):\n${trimmed}\n\n` +
        `Task: Create a structured report that is SPECIFIC to the Document Text. For each section, reference concrete details (e.g., problem statements, methods, results, datasets, algorithms, parameters). Avoid vague outlines.\n` +
        `Return JSON with the following shape strictly (no extra text):\n` +
        `{"title": string, "tone": string, "executiveSummary": string, "sections": Array<{ "title": string, "content": string }>, "references": string[]}`,
    },
  ]
}

function safeExtractJSON(text: string) {
  // Try direct parse first
  try {
    return JSON.parse(text)
  } catch {}
  // Fallback: extract first JSON block
  const match = text.match(/\{[\s\S]*\}$/)
  if (match) {
    try {
      return JSON.parse(match[0])
    } catch {}
  }
  return null
}

export async function generateGroqReport(options: GroqOptions) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return { ok: false, error: "Missing GROQ_API_KEY" as const }
  }

  const model = "llama-3.1-8b-instant" // fast, suitable default
  const messages = buildPrompt(options)

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    return { ok: false, error: `Groq error: ${res.status} ${body}` as const }
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.message || ""

  const json = typeof content === "string" ? safeExtractJSON(content) : content
  if (!json) {
    return { ok: false, error: "Unable to parse Groq JSON response" as const }
  }

  // Normalize minimal shape expected by the UI
  return {
    ok: true,
    report: {
      title: json.title || options.title || "Automated Report",
      tone: json.tone || options.tone || "neutral",
      executiveSummary: json.executiveSummary || "Summary unavailable from model response.",
      sections: Array.isArray(json.sections) ? json.sections : [],
      references: Array.isArray(json.references) ? json.references : [],
      // You can extend normalization here if your UI expects more fields
      tags: ["groq"],
      generator: "groq",
    },
  }
}
