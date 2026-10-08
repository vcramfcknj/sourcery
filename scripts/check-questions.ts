// Checks what difficulty the reviewer requested vs what got stored, plus
// quick integrity stats on the stored questions (evidence, option shuffle).
// Run: node --env-file=.env.local --import tsx scripts/check-questions.ts <reviewerId>
import { Client } from 'pg'

async function main() {
  const rid = process.argv[2]
  if (!rid) {
    console.error('usage: check-questions.ts <reviewerId>')
    process.exit(1)
  }
  const db = new Client({ connectionString: process.env.DATABASE_URL! })
  await db.connect()

  const r = await db.query(
    'select name, difficulty, question_types, requested_question_count, question_count, status from reviewers where id = $1',
    [rid],
  )
  console.log('reviewer:', JSON.stringify(r.rows[0]))

  const q = await db.query(
    `select order_index, type, difficulty,
            jsonb_array_length(options) as n_options,
            (options @> to_jsonb(correct_answer)) as answer_in_options,
            char_length(source_text) > 0 as has_evidence,
            source_page, left(question, 60) as q
       from questions where reviewer_id = $1 order by order_index`,
    [rid],
  )
  console.log('\nstored questions:')
  for (const row of q.rows) {
    console.log(
      `${row.order_index} [${row.type}/${row.difficulty}] opts=${row.n_options} answerInOpts=${row.answer_in_options} evidence=${row.has_evidence} p=${row.source_page ?? '-'} | ${row.q}`,
    )
  }

  // Where does the correct answer sit in the shuffled option list? Should vary.
  const pos = await db.query(
    `select o.ordinality as answer_slot, count(*)::int as n
       from questions q,
            jsonb_array_elements_text(q.options) with ordinality as o(value, ordinality)
      where q.reviewer_id = $1 and q.type = 'multiple_choice' and o.value = q.correct_answer
      group by 1 order by 1`,
    [rid],
  )
  console.log('\nMC correct-answer slot distribution:', pos.rows.map((p) => `slot ${p.answer_slot}: ${p.n}`).join(', '))

  await db.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
