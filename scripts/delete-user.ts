/**
 * Deletes the local dev account(s) so the signup -> verification -> login
 * flow can be tested from scratch (user's explicit request). Hard delete,
 * no undo - mirrors the PRD 27.4 decision. All DB rows (profile, reviewers,
 * documents, attempts...) cascade from auth.users per the schema; storage
 * objects are removed explicitly by the {user_id}/ prefix.
 * Run: node --env-file=.env.local --import tsx scripts/delete-user.ts
 */
import { createAdminClient } from '../src/lib/supabase/admin'
import { DOCUMENTS_BUCKET } from '../src/lib/constants'

async function main() {
  const admin = createAdminClient()

  const { data: users, error } = await admin.auth.admin.listUsers()
  if (error) throw new Error(`listUsers failed: ${error.message}`)
  if (users.users.length === 0) {
    console.log('No users exist — already clean.')
    return
  }

  for (const user of users.users) {
    console.log(`Deleting ${user.email} (${user.id})`)

    // Storage files first (they are keyed by user id, not FK-cascaded).
    const { data: objs } = await admin.storage
      .from(DOCUMENTS_BUCKET)
      .list(`${user.id}`, { limit: 1000 })
    const paths = (objs ?? []).map((o) => `${user.id}/${o.name}`)
    if (paths.length > 0) {
      const { error: stErr } = await admin.storage.from(DOCUMENTS_BUCKET).remove(paths)
      if (stErr) console.error(`  storage cleanup failed: ${stErr.message}`)
      else console.log(`  removed ${paths.length} storage object(s)`)
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(user.id)
    if (delErr) console.error(`  delete failed: ${delErr.message}`)
    else console.log('  user deleted (DB cascade handles profile + all rows)')
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
