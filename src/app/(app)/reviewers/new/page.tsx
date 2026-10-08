import type { Metadata } from 'next'
import { CreateReviewerForm } from '@/components/CreateReviewerForm'
import { CreateScreenShell } from '@/components/CreateScreenShell'

export const metadata: Metadata = { title: 'Create Reviewer' }

// Phase 2 (PRD 10.1 / 29.1): name + file upload + count/types/difficulty.
export default function CreateReviewerPage() {
  return (
    <CreateScreenShell
      backHref="/dashboard"
      title="Create a reviewer"
      subtitle="Upload your material and we&apos;ll turn it into questions you can trust."
      variant="questions"
    >
      <CreateReviewerForm />
    </CreateScreenShell>
  )
}
