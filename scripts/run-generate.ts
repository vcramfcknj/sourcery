// Runs the generate pipeline directly for one reviewer (same code the worker
// executes) with full console capture. Pass the reviewer id as argv[2].
// Run: node --env-file=.env.local --import tsx scripts/run-generate.ts <reviewerId>
import { handleGenerateQuestions } from '../src/lib/jobs/generate'
import { createAdminClient } from '../src/lib/supabase/admin'

async function main() {
  const reviewerId = process.argv[2]
  if (!reviewerId) {
    console.error('usage: run-generate.ts <reviewerId>')
    process.exit(1)
  }
  const { data: reviewer, error } = await createAdminClient()
    .from('reviewers')
    .select('user_id')
    .eq('id', reviewerId)
    .maybeSingle()
  if (error || !reviewer) {
    console.error('reviewer not found:', error?.message)
    process.exit(1)
  }
  const t0 = Date.now()
  await handleGenerateQuestions({ reviewerId, userId: reviewer.user_id })
  console.log(`finished in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
