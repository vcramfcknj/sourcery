'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DOCUMENTS_BUCKET } from '@/lib/constants'

/**
 * Account deletion (PRD 27.4: "Provide account deletion that removes all of
 * a user's data"). Hard delete, no undo — the Phase 1 decision. The session
 * user is the only account this can ever target: the uid comes from the
 * verified JWT, never from form input. DB rows (profile, reviewers,
 * documents, chunks, questions, attempts, answers) cascade from auth.users;
 * storage objects are keyed by {user_id}/ and removed explicitly first.
 */
export async function deleteAccountAction(
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) redirect('/login')
  // Guard: without an email there is nothing to confirm against — refuse the
  // delete rather than letting an empty typed value match an empty account.
  if (!user.email) return { error: 'This account has no email to confirm against.' }

  // Deliberate friction for an irreversible action: the user must type the
  // exact account email (checked server-side, not just in the UI).
  const confirmation = String(formData.get('confirm_email') ?? '').trim().toLowerCase()
  if (!confirmation || confirmation !== user.email.toLowerCase()) {
    return { error: 'The typed email does not match your account email.' }
  }

  const admin = createAdminClient()

  // Storage objects live under {user_id}/ (no FK cascade covers these).
  const { data: objs } = await admin.storage
    .from(DOCUMENTS_BUCKET)
    .list(user.id, { limit: 1000 })
  const paths = (objs ?? []).map((o) => `${user.id}/${o.name}`)
  if (paths.length > 0) {
    const { error: stErr } = await admin.storage.from(DOCUMENTS_BUCKET).remove(paths)
    if (stErr) console.error('account storage cleanup failed:', stErr.message)
  }

  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) {
    console.error('account delete failed:', error.message)
    return { error: 'Could not delete your account. Please try again.' }
  }

  // Clear the now-dead session cookies, then leave the app entirely.
  await supabase.auth.signOut()
  redirect('/?deleted=1')
}
