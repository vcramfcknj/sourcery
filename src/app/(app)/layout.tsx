import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { AppHeader } from '@/components/AppHeader'
import { Sidebar } from '@/components/Sidebar'
import { MobileTabBar } from '@/components/MobileTabBar'
import { RouteTransition } from '@/components/RouteTransition'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Route protection for the whole workspace (PRD 8.3).
  const user = await requireUser()

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex min-h-screen bg-background">
      {/* Keyboard users can jump past the sidebar/header (WCAG 2.4.1). */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-brand focus:px-5 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white focus:shadow-card"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader displayName={profile?.display_name ?? null} email={user.email ?? ''} />
        {/* Workspace fills large screens: individual pages cap their own
            reading width; this bound only stops lines running edge-to-edge
            on ultrawide monitors. */}
        <main id="main" className="mx-auto w-full max-w-[1600px] flex-1 px-5 pt-8 pb-28 sm:px-8 md:pb-8 print:max-w-none print:px-0 print:py-2">
          <RouteTransition>{children}</RouteTransition>
        </main>
      </div>
      {/* Mobile bottom navigation (hidden from `md` up, where the Sidebar
          rail takes over). Extra pb on <main> keeps content clear of it. */}
      <MobileTabBar />
    </div>
  )
}
