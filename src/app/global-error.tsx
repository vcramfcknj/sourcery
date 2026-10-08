'use client'

/**
 * Last-resort boundary for errors that break the root layout itself (e.g. a
 * crash while rendering <html>/<body>). It must render its own html/body and
 * stay self-contained — no design-system classes, in case the stylesheet is
 * what failed to load.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          textAlign: 'center',
          background: '#f4f1ea',
          color: '#2b2e5e',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h1 style={{ fontSize: 24, margin: 0 }}>Something spilled.</h1>
        <p style={{ maxWidth: 360, fontSize: 14, opacity: 0.75, margin: 0 }}>
          An unexpected error occurred. Your material and progress are safe.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: 8,
            padding: '12px 24px',
            borderRadius: 9999,
            border: 0,
            background: '#5a61b7',
            color: '#fff',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
