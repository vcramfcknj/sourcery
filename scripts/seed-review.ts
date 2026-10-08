/**
 * Seeds a minimal, clearly-labeled "ready" reviewer with 5 multiple-choice
 * questions so the Phase 4 review flow (start -> answer -> resume -> finish)
 * can be exercised WITHOUT spending real AI generation calls. Delete the
 * reviewer from the dashboard afterwards and the cascade cleans everything up.
 * Run: node --env-file=.env.local --import tsx scripts/seed-review.ts
 */
import { createAdminClient } from '../src/lib/supabase/admin'

async function main() {
  const admin = createAdminClient()

  const { data: users, error: userError } = await admin.auth.admin.listUsers()
  if (userError || !users.users.length) throw new Error(`No auth user found: ${userError?.message}`)
  const user = users.users[0]

  const chunkContent =
    'The sinoatrial node is the primary pacemaker of the heart. The atrioventricular node delays the impulse before passing it to the ventricles. Oxygen diffuses across the alveolar membrane into the blood. The aorta carries oxygenated blood from the left ventricle to the body. Cardiac output is the volume of blood the heart pumps per minute.'

  const { data: reviewer, error: revErr } = await admin
    .from('reviewers')
    .insert({
      user_id: user.id,
      name: 'Phase 4 test reviewer',
      status: 'ready',
      requested_question_count: 5,
      question_count: 5,
      question_types: ['multiple_choice'],
      difficulty: 'easy',
    })
    .select('id')
    .single()
  if (revErr) throw new Error(`reviewer: ${revErr.message}`)

  const { data: document, error: docErr } = await admin
    .from('documents')
    .insert({
      reviewer_id: reviewer.id,
      file_name: 'phase4-seed-placeholder.pdf',
      file_type: 'application/pdf',
      file_size: 1024,
      storage_path: `${user.id}/${reviewer.id}/phase4-seed-placeholder.pdf`,
      page_count: 1,
      extraction_status: 'extracted',
      text_quality_score: 1,
    })
    .select('id')
    .single()
  if (docErr) throw new Error(`document: ${docErr.message}`)

  const { data: chunk, error: chunkErr } = await admin
    .from('document_chunks')
    .insert({
      document_id: document.id,
      chunk_index: 0,
      page_number: 1,
      section_title: 'Cardiac Conduction',
      paragraph_index: 0,
      char_start: 0,
      char_end: chunkContent.length,
      content: chunkContent,
    })
    .select('id')
    .single()
  if (chunkErr) throw new Error(`chunk: ${chunkErr.message}`)

  const questions = [
    { question: 'What is the primary pacemaker of the heart?', options: ['Atrioventricular node', 'Sinoatrial node', 'Purkinje fibers', 'Bundle of His'], correct_answer: 'Sinoatrial node', source_section: 'Cardiac Conduction' },
    { question: 'Which structure delays the impulse before it reaches the ventricles?', options: ['Atrioventricular node', 'Sinoatrial node', 'Aorta', 'Alveolar membrane'], correct_answer: 'Atrioventricular node', source_section: 'Cardiac Conduction' },
    { question: 'Where does oxygen diffuse into the blood?', options: ['Alveolar membrane', 'Bundle of His', 'Left ventricle', 'Purkinje fibers'], correct_answer: 'Alveolar membrane', source_section: 'Gas Exchange' },
    { question: 'What does the aorta carry from the left ventricle?', options: ['Deoxygenated blood to the lungs', 'Oxygenated blood to the body', 'Lymph to the nodes', 'Air to the alveoli'], correct_answer: 'Oxygenated blood to the body', source_section: 'Vessels' },
    { question: 'Cardiac output measures what?', options: ['Volume of blood pumped per minute', 'Heart rate at rest', 'Oxygen saturation in the aorta', 'Pressure in the ventricles'], correct_answer: 'Volume of blood pumped per minute', source_section: 'Hemodynamics' },
  ]

  const rows = questions.map((q, i) => ({
    reviewer_id: reviewer.id,
    order_index: i,
    type: 'multiple_choice',
    question: q.question,
    options: q.options,
    correct_answer: q.correct_answer,
    explanation: `The material states the answer directly in the "${q.source_section}" section.`,
    source_chunk_id: chunk.id,
    source_page: 1,
    source_section: q.source_section,
    source_text: chunkContent.split('. ').find((s) => s.toLowerCase().includes(q.correct_answer.toLowerCase().split(' ')[0])) ?? chunkContent.slice(0, 60),
    source_char_start: 0,
    source_char_end: 60,
    topic: q.source_section,
    difficulty: 'easy',
    version: 1,
  }))
  const { data: qRows, error: qErr } = await admin
    .from('questions')
    .insert(rows)
    .select('id, correct_answer, options')
  if (qErr) throw new Error(`questions: ${qErr.message}`)

  // Also seed ONE completed attempt so the Phase 5 results / answer-review /
  // history screens can be exercised without spending AI calls or clicking
  // through the review: 3 correct, 1 wrong, 1 skipped.
  const insertedQuestions = qRows ?? []
  const wrongPick = (q: { correct_answer: string; options: string[] }) =>
    q.options.find((o) => o !== q.correct_answer) ?? q.correct_answer
  const plan: Array<'correct' | 'wrong' | 'skip'> = ['correct', 'wrong', 'correct', 'skip', 'correct']
  const answers = insertedQuestions.map((q, i) => {
    const mode = plan[i % plan.length]
    const userAnswer = mode === 'correct' ? q.correct_answer : mode === 'wrong' ? wrongPick(q) : null
    return {
      question_id: q.id,
      question_version: 1,
      user_answer: userAnswer,
      is_correct: userAnswer !== null && userAnswer === q.correct_answer,
      answered_at: new Date().toISOString(),
    }
  })
  const score = answers.filter((a) => a.is_correct).length

  const { data: attempt, error: attErr } = await admin
    .from('attempts')
    .insert({
      reviewer_id: reviewer.id,
      user_id: user.id,
      status: 'completed',
      shuffle_seed: 1234567,
      score,
      total_questions: insertedQuestions.length,
      percentage: Math.round((score / insertedQuestions.length) * 10000) / 100,
      started_at: new Date(Date.now() - 60_000).toISOString(),
      completed_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (attErr) throw new Error(`attempt: ${attErr.message}`)

  const { error: ansErr } = await admin
    .from('attempt_answers')
    .insert(answers.map((a) => ({ ...a, attempt_id: attempt.id })))
  if (ansErr) throw new Error(`answers: ${ansErr.message}`)

  console.log(
    `Seeded reviewer ${reviewer.id} ("Phase 4 test reviewer") with ${insertedQuestions.length} MC questions and a completed attempt (${score}/${insertedQuestions.length}) for user ${user.id}.`,
  )
}

main().catch((err) => { console.error(err); process.exit(1) })
