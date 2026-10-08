// Lists the models available to the current GROQ_API_KEY so the pipeline
// can target real, accessible model IDs.
// Run: node --env-file=.env.local --import tsx scripts/list-groq-models.ts
export {}

async function main() {
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
  })
  if (!res.ok) {
    console.error(`HTTP ${res.status}:`, await res.text())
    process.exit(1)
  }
  const json = (await res.json()) as { data?: { id?: string; owned_by?: string }[] }
  const ids = (json.data ?? []).map((m) => m.id).filter(Boolean) as string[]
  console.log(`${ids.length} models available:\n`)
  for (const id of ids.sort()) console.log(id)
}

main()
