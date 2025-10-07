# Automated Report Generation API

This application generates structured reports from uploaded documents using AI (GPT-5) with optional web search enrichment.  

---

## **Technologies Used**

- Next.js (API routes)
- TypeScript
- Zod (schema validation)
- OpenAI GPT-5 (`generateObject`) for AI extraction
- JSZip (DOCX parsing)
- pdfjs-dist (PDF parsing)
- GROQ (optional, for structured report generation)
- Node.js

---

## **Dependencies**

Install dependencies using npm:

```bash
npm install next typescript zod jszip pdfjs-dist
