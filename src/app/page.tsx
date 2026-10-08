import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { Logo } from '@/components/Logo'
import { CauldronScene } from '@/components/CauldronScene'

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>
}) {
  const user = await getUser()
  if (user) redirect('/dashboard')
  const sp = await searchParams

  return (
    <div className="min-h-screen bg-background text-foreground">
      {sp.deleted && (
        // Account-deletion confirmation (never a silent success).
        <div
          role="status"
          className="mx-auto mt-4 w-full max-w-5xl rounded-2xl border border-success/40 bg-success/10 px-5 py-3 text-sm font-medium text-success"
        >
          Your account and all of its data have been permanently deleted.
        </div>
      )}
      {/* Floating pill navigation */}
      <header className="sticky top-0 z-40 px-4 pt-4">
        <nav className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 rounded-full border border-line bg-surface/85 px-4 py-2.5 shadow-card backdrop-blur-md">
          <Logo />
          <div className="hidden items-center gap-7 text-sm font-medium md:flex">
            <a href="#how" className="text-muted transition hover:text-foreground">
              How it works
            </a>
            <a href="#features" className="text-muted transition hover:text-foreground">
              Features
            </a>
            <a href="#faq" className="text-muted transition hover:text-foreground">
              FAQ
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-full px-4 py-2 text-sm font-medium text-muted transition hover:text-foreground sm:block"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-hover"
            >
              Get started
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto w-full max-w-5xl px-4 pb-8 pt-10 sm:pt-14">
          <div className="grid items-center gap-8 rounded-[28px] border border-line bg-surface p-6 shadow-card md:grid-cols-2 md:p-10">
            <div className="anim-fade-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-background px-3 py-1 text-xs font-semibold text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
                Your notes, turned into questions. With receipts.
              </span>
              <h1 className="mt-5 text-4xl font-bold leading-[1.06] sm:text-5xl">
                Turn your study material into a reviewer that{' '}
                <span className="text-brand">shows its work.</span>
              </h1>
              <p className="mt-5 max-w-md text-lg text-muted">
                Upload a PDF or DOCX and Sourcery brews fresh, source-cited
                questions from your own pages — then proves every answer with
                the exact passage behind it.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/signup"
                  className="rounded-full bg-brand px-6 py-3 font-semibold text-white shadow-soft transition hover:bg-brand-hover"
                >
                  Create your first reviewer
                </Link>
                <a
                  href="#how"
                  className="rounded-full border border-line bg-surface px-6 py-3 font-semibold text-foreground transition hover:border-brand/40 hover:text-brand"
                >
                  See how it works
                </a>
              </div>
              <p className="mt-5 text-sm text-muted">
                No card required · your upload stays yours · delete anytime.
              </p>
            </div>

            {/* Animated vector panel */}
            <div className="relative anim-fade-up" style={{ animationDelay: '0.12s' }}>
              <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-sidebar-2 via-sidebar to-brand p-6 shadow-clay">
                <div
                  className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-periwinkle/30 blur-2xl anim-glow"
                  aria-hidden
                />
                <CauldronScene className="relative mx-auto w-full max-w-[22rem]" />
                <p className="relative mt-2 text-center text-sm font-medium text-white/80">
                  Brewing questions from your source
                </p>
              </div>
              <HeroChip className="-left-3 top-8" delay="0.4s" label="Source-cited" />
              <HeroChip className="-right-2 top-1/3" delay="1.1s" label="Shuffled every retake" />
              <HeroChip className="bottom-6 left-6" delay="1.8s" label="Scored on the server" />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto w-full max-w-5xl scroll-mt-24 px-4 py-16 sm:py-20">
          <SectionHeading
            eyebrow="How it works"
            title="Three steps from upload to answer"
            sub="A straight line from your raw material to a reviewer you can trust."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div
                key={s.title}
                className="relative rounded-card border border-line bg-surface p-6 shadow-card"
              >
                <span className="font-display text-4xl font-extrabold text-periwinkle">
                  {s.n}
                </span>
                <h3 className="mt-2 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
                {i < STEPS.length - 1 && (
                  <span
                    className="absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-background text-xs text-muted md:flex"
                    aria-hidden
                  >
                    →
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          className="mx-auto w-full max-w-5xl scroll-mt-24 px-4 py-16 sm:py-20"
        >
          <SectionHeading
            eyebrow="Why Sourcery"
            title="Built to be trusted, not just used"
            sub="Every choice below comes straight from how the reviewer actually works."
          />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-card border border-line bg-surface p-6 shadow-card transition duration-200 hover:-translate-y-1 hover:shadow-soft"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-periwinkle-soft text-brand shadow-clay">
                  {f.icon}
                </span>
                <h3 className="mt-4 font-bold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto w-full max-w-3xl scroll-mt-24 px-4 py-16 sm:py-20">
          <SectionHeading eyebrow="FAQ" title="Questions, answered" />
          <div className="mt-10 space-y-3">
            {FAQS.map((f, i) => (
              <details
                key={f.q}
                open={i === 0}
                className="group rounded-card border border-line bg-surface p-5 shadow-card [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {f.q}
                  <span
                    className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full bg-periwinkle-soft text-brand transition duration-200 group-open:rotate-45"
                    aria-hidden
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      {/* Final CTA + wave, flowing into the footer */}
      <section className="relative mt-8 overflow-hidden bg-gradient-to-b from-brand via-sidebar to-sidebar-2 text-white">
        <svg
          aria-hidden
          className="absolute inset-x-0 top-0 h-16 w-full text-background sm:h-24"
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
        >
          <path fill="currentColor" d="M0,0 L1440,0 L1440,36 C1080,120 360,120 0,36 Z" />
        </svg>

        <div className="relative mx-auto w-full max-w-3xl px-4 pt-28 text-center sm:pt-36">
          <div className="mx-auto -mt-24 mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand text-white shadow-card ring-8 ring-sidebar-2/40">
            <span className="font-display text-3xl font-extrabold" aria-hidden>
              S
            </span>
          </div>
          <h2 className="text-3xl font-bold leading-tight sm:text-4xl">
            Start turning notes into questions that show their receipts.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-white/80">
            Create a reviewer from your own material in a couple of minutes.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-full bg-surface px-6 py-3 font-semibold text-brand shadow-soft transition hover:bg-periwinkle-soft"
            >
              Get started free
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-white/30 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
            >
              Log in
            </Link>
          </div>
        </div>

        {/* Footer */}
        <footer className="relative mx-auto mt-20 w-full max-w-5xl px-6 pb-10">
          <div className="grid gap-10 border-t border-white/15 pt-12 sm:grid-cols-2 md:grid-cols-4">
            <div className="sm:col-span-2 md:col-span-1">
              <Logo tone="light" />
              <p className="mt-3 max-w-xs text-sm text-white/70">
                An interactive reviewer from your own material. No source, no spell.
              </p>
            </div>
            <FooterCol
              title="Product"
              links={[
                { label: 'How it works', href: '#how' },
                { label: 'Features', href: '#features' },
                { label: 'FAQ', href: '#faq' },
              ]}
            />
            <FooterCol
              title="Account"
              links={[
                { label: 'Log in', href: '/login' },
                { label: 'Create account', href: '/signup' },
                { label: 'Forgot password', href: '/forgot-password' },
              ]}
            />
            <div>
              <h3 className="font-display text-sm font-bold uppercase tracking-wide text-white/90">
                Your data
              </h3>
              <p className="mt-3 text-sm text-white/70">
                Files are visible only to you. Deleting your account removes every
                document, question and attempt for good.
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/15 pt-6 text-sm text-white/60 sm:flex-row">
            <p>
              © 2026 Sourcery. All rights reserved.{' '}
              <Link href="/privacy" className="font-medium text-white/80 underline-offset-2 hover:underline">
                Privacy &amp; terms
              </Link>
            </p>
            <p>Brewed from your own notes.</p>
          </div>

          <p
            aria-hidden
            className="pointer-events-none mt-6 select-none text-center font-display text-6xl font-extrabold leading-none text-white/5 sm:text-8xl"
          >
            Sourcery
          </p>
        </footer>
      </section>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function HeroChip({
  label,
  className = '',
  delay = '0s',
}: {
  label: string
  className?: string
  delay?: string
}) {
  return (
    <span
      className={`absolute hidden items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-foreground shadow-card anim-float sm:inline-flex ${className}`}
      style={{ animationDelay: delay }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
      {label}
    </span>
  )
}

function SectionHeading({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string
  title: string
  sub?: string
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-bold sm:text-4xl">{title}</h2>
      {sub && <p className="mt-3 text-muted">{sub}</p>}
    </div>
  )
}

function FooterCol({
  title,
  links,
}: {
  title: string
  links: { label: string; href: string }[]
}) {
  return (
    <div>
      <h3 className="font-display text-sm font-bold uppercase tracking-wide text-white/90">
        {title}
      </h3>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.label}>
            <a href={l.href} className="text-white/70 transition hover:text-white">
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

const STEPS = [
  {
    n: '01',
    title: 'Upload your material',
    body: 'Drop in a PDF or DOCX. Sourcery reads it and treats it as the single source of truth — it never pulls facts from outside your file.',
  },
  {
    n: '02',
    title: 'We brew a reviewer',
    body: 'Sourcery generates fresh questions tied to your own pages, then shuffles the order and answer options for every attempt.',
  },
  {
    n: '03',
    title: 'Review with receipts',
    body: 'Answer without spoilers, then open the results to see the exact source passage behind every question you got wrong or skipped.',
  },
]

const FEATURES = [
  {
    title: 'Source-cited answers',
    body: 'Every question links back to the page, section and quote it came from — review the receipts, not just the grade.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
        <path d="M14 3v4h4M9 12h6M9 16h4" />
      </svg>
    ),
  },
  {
    title: 'Your material only',
    body: 'Questions are drawn solely from what you upload. Sourcery never invents facts beyond your document.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" />
        <path d="M20 18v3H6.5A2.5 2.5 0 0 1 4 18.5" />
      </svg>
    ),
  },
  {
    title: 'Server-side scoring',
    body: 'Correctness and scores are computed on the server, so results can’t be tampered with from the browser.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6Z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: 'Private by design',
    body: 'Your files belong to you. Delete your account and every document, question and attempt is removed for good.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
    ),
  },
]

const FAQS = [
  {
    q: 'What exactly does Sourcery do?',
    a: 'You upload study material (PDF or DOCX). Sourcery turns it into an interactive reviewer of questions and shows the exact source passage behind each one, so you can verify every answer instead of trusting a grade.',
  },
  {
    q: 'Does it use anything besides my upload?',
    a: 'No. Your uploaded material is the sole source of truth. Sourcery only builds questions from what you provide and never adds outside facts.',
  },
  {
    q: 'Where do the questions and answers come from?',
    a: 'Each question is generated from your document and tied to a source quote and page. During a review we never reveal the answer — you see it, with the passage, on the results screen afterwards.',
  },
  {
    q: 'Is my material private?',
    a: 'Yes. Files are stored under your own account and are only ever visible to you. Deleting your account permanently removes your documents, extracted chunks, questions, attempts and stored files.',
  },
  {
    q: 'Can I retake a review?',
    a: 'Any time. Each retake reshuffles the question order and the answer options, and your completed attempts are kept in a history you can revisit.',
  },
]
