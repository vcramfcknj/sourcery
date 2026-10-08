import { Logo } from '@/components/Logo'
import { CauldronScene } from '@/components/CauldronScene'

/**
 * Two-panel auth layout (mirrors the reference split screen, in Sourcery's
 * claymorphism identity): deep-indigo brand panel with the animated cauldron
 * scene on the left, cream form panel on the right. Below lg the illustration
 * panel is dropped and a compact logo heads the form instead.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel - decorative, animated (motion off under reduced-motion) */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-sidebar-2 via-sidebar to-brand p-10 xl:p-12">
        <div className="anim-fade-up">
          <Logo tone="light" href="/login" />
        </div>
        <div className="anim-fade-up max-w-md" style={{ animationDelay: '0.12s' }}>
          <h2 className="font-display text-3xl font-bold leading-snug text-white xl:text-4xl">
            Turn your notes into exam-ready reviews.
          </h2>
          <p className="mt-3 text-periwinkle-soft">
            Brewed from your own material — nothing invented, nothing leaked.
          </p>
        </div>
        <CauldronScene
          className="anim-fade-up mx-auto w-full max-w-md"
          style={{ animationDelay: '0.24s' }}
        />
      </aside>

      {/* Form panel */}
      <section className="flex items-center justify-center bg-background px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo />
          </div>
          <div className="rounded-card border border-line bg-surface p-6 sm:p-8 shadow-card anim-fade-up" style={{ animationDelay: '0.18s' }}>
            {children}
          </div>
        </div>
      </section>
    </main>
  )
}
