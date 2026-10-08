// One-time live probe: verifies GROQ_API_KEY and the three model IDs the
// pipeline uses (generation, L2 re-answer, L3 judge) with minimal calls.
// Run: node --env-file=.env.local --import tsx scripts/probe-groq.ts
import { generateObject } from 'ai'
import { createGroq as createGroqProvider } from '@ai-sdk/groq'
import { z } from 'zod'
import { AI_MODELS } from '../src/lib/constants'

const apiKey = process.env.GROQ_API_KEY
if (!apiKey) {
  console.error('FAIL: GROQ_API_KEY is not set in the environment')
  process.exit(1)
}

const groq = createGroqProvider({ apiKey })

const probeSchema = z.object({ answer: z.string() })

async function probe(label: string, modelId: string) {
  try {
    const result = await generateObject({
      model: groq(modelId),
      schema: probeSchema,
      prompt: 'Reply with exactly the word "ok" in the answer field.',
      temperature: 0,
      // gpt-oss models emit reasoning tokens before JSON; a tight cap
      // truncates the answer (the real pipeline sets no max here).
      maxOutputTokens: 1024,
    })
    const usage = (result as { usage?: { inputTokens?: number; outputTokens?: number } }).usage
    console.log(
      `PASS ${label} (${modelId}): answer="${result.object.answer}", ` +
        `tokens ${usage?.inputTokens ?? '?'}/${usage?.outputTokens ?? '?'}`,
    )
    return true
  } catch (err) {
    console.error(`FAIL ${label} (${modelId}): ${err instanceof Error ? err.message : err}`)
    return false
  }
}

async function main() {
  console.log('Groq live probe — 3 minimal calls, one per pipeline model\n')
  const results: boolean[] = []
  results.push(await probe('generation', AI_MODELS.GENERATION))
  results.push(await probe('L2 re-answer', AI_MODELS.L2_CLOSED_EVIDENCE))
  results.push(await probe('L3 judge', AI_MODELS.L3_JUDGE))
  const failed = results.filter((r) => !r).length
  console.log(failed === 0 ? '\nAll models reachable. Pipeline is ready.' : `\n${failed} model(s) failed.`)
  process.exit(failed === 0 ? 0 : 1)
}

main()
