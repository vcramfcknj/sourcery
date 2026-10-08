import type { CSSProperties } from 'react'

/**
 * Animated cauldron scene for the auth brand panel. Pure inline SVG + CSS
 * keyframe classes (globals.css) - no animation library, no raster art.
 * Decorative: aria-hidden, and every motion class is disabled under
 * prefers-reduced-motion. Positioning transforms live on OUTER groups so the
 * animation classes on INNER groups compose without fighting.
 */
export function CauldronScene({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg
      viewBox="0 0 440 380"
      className={className}
      style={style}
      role="img"
      aria-label="A bubbling cauldron brewing flashcards out of study books"
    >
      <defs>
        <radialGradient id="cauldron-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a6b0e4" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#a6b0e4" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cauldron-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4a509e" />
          <stop offset="100%" stopColor="#2e3268" />
        </linearGradient>
        <linearGradient id="liquid-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c6cdf0" />
          <stop offset="100%" stopColor="#a6b0e4" />
        </linearGradient>
      </defs>

      {/* Ambient glow behind the pot */}
      <g transform="translate(220 200)">
        <ellipse className="anim-glow" cx="0" cy="0" rx="170" ry="140" fill="url(#cauldron-glow)" />
      </g>

      {/* Halo ring of twinkles around the brew */}
      <g fill="#c6cdf0">
        <g transform="translate(128 96)">
          <path className="anim-twinkle" style={{ animationDelay: '0s' }} d="M0 -9 L2.2 -2.2 L9 0 L2.2 2.2 L0 9 L-2.2 2.2 L-9 0 L-2.2 -2.2 Z" />
        </g>
        <g transform="translate(316 84) scale(0.8)">
          <path className="anim-twinkle" style={{ animationDelay: '0.9s' }} d="M0 -9 L2.2 -2.2 L9 0 L2.2 2.2 L0 9 L-2.2 2.2 L-9 0 L-2.2 -2.2 Z" fill="#f4f1ea" />
        </g>
        <g transform="translate(342 168) scale(0.65)">
          <path className="anim-twinkle" style={{ animationDelay: '1.7s' }} d="M0 -9 L2.2 -2.2 L9 0 L2.2 2.2 L0 9 L-2.2 2.2 L-9 0 L-2.2 -2.2 Z" />
        </g>
        <g transform="translate(96 190) scale(0.6)">
          <path className="anim-twinkle" style={{ animationDelay: '2.3s' }} d="M0 -9 L2.2 -2.2 L9 0 L2.2 2.2 L0 9 L-2.2 2.2 L-9 0 L-2.2 -2.2 Z" fill="#f4f1ea" />
        </g>
      </g>

      {/* Rising flashcards - knowledge leaving the brew */}
      <g transform="translate(168 122) rotate(-10)">
        <g className="anim-float" style={{ animationDelay: '0.4s, 0.4s' }}>
          <rect x="-26" y="-18" width="52" height="36" rx="6" fill="#ffffff" />
          <rect x="-26" y="-18" width="52" height="36" rx="6" fill="none" stroke="#e8e3d9" strokeWidth="2" />
          <line x1="-16" y1="-6" x2="16" y2="-6" stroke="#a6b0e4" strokeWidth="3" strokeLinecap="round" />
          <line x1="-16" y1="4" x2="8" y2="4" stroke="#c6cdf0" strokeWidth="3" strokeLinecap="round" />
        </g>
      </g>
      <g transform="translate(284 140) rotate(9)">
        <g className="anim-float" style={{ animationDelay: '1.6s, 1.6s' }}>
          <rect x="-22" y="-15" width="44" height="30" rx="5" fill="#f4f1ea" />
          <rect x="-22" y="-15" width="44" height="30" rx="5" fill="none" stroke="#e8e3d9" strokeWidth="2" />
          <line x1="-13" y1="-4" x2="13" y2="-4" stroke="#a6b0e4" strokeWidth="3" strokeLinecap="round" />
          <line x1="-13" y1="5" x2="5" y2="5" stroke="#c6cdf0" strokeWidth="3" strokeLinecap="round" />
        </g>
      </g>

      {/* Bubbles - each in its own group so translateY is user-unit based */}
      <g fill="#c6cdf0" stroke="#ffffff" strokeOpacity="0.35">
        <g transform="translate(196 176)">
          <circle className="anim-bubble" style={{ animationDelay: '0s' }} r="9" />
        </g>
        <g transform="translate(224 172)">
          <circle className="anim-bubble" style={{ animationDelay: '1.2s' }} r="6" />
        </g>
        <g transform="translate(248 178)">
          <circle className="anim-bubble" style={{ animationDelay: '2.1s' }} r="8" />
        </g>
        <g transform="translate(208 180)">
          <circle className="anim-bubble" style={{ animationDelay: '2.9s' }} r="4.5" />
        </g>
      </g>

      {/* Cauldron body, rim, liquid */}
      <g>
        <path
          d="M112 196 C112 268 152 300 220 300 C288 300 328 268 328 196 Z"
          fill="url(#cauldron-body)"
        />
        {/* glassy highlight on the belly */}
        <path d="M138 214 C140 254 164 282 202 291" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="10" strokeLinecap="round" fill="none" />
        {/* legs */}
        <rect x="158" y="296" width="20" height="26" rx="8" fill="#2e3268" />
        <rect x="262" y="296" width="20" height="26" rx="8" fill="#2e3268" />
        {/* side handles */}
        <path d="M112 210 C90 208 86 236 110 242" fill="none" stroke="#2e3268" strokeWidth="10" strokeLinecap="round" />
        <path d="M328 210 C350 208 354 236 330 242" fill="none" stroke="#2e3268" strokeWidth="10" strokeLinecap="round" />
        {/* liquid surface (breathes) */}
        <g transform="translate(220 194)">
          <ellipse className="anim-liquid" cx="0" cy="0" rx="100" ry="15" fill="url(#liquid-top)" />
        </g>
        {/* rim */}
        <rect x="102" y="182" width="236" height="16" rx="8" fill="#2b2e5e" />
      </g>

      {/* Flame under the pot */}
      <g transform="translate(220 330)">
        <path className="anim-flame" d="M0 8 C-16 -2 -12 -22 0 -34 C12 -22 16 -2 0 8 Z" fill="#b6791f" />
        <path className="anim-flame" style={{ animationDelay: '0.3s' }} d="M0 6 C-8 -1 -6 -13 0 -21 C6 -13 8 -1 0 6 Z" fill="#e0a23e" />
      </g>

      {/* Floating study books the cauldron rests above */}
      <g transform="translate(112 344) rotate(-5)">
        <g className="anim-float" style={{ animationDelay: '0.8s, 0.8s' }}>
          <rect x="-46" y="-9" width="92" height="18" rx="4" fill="#a6b0e4" />
          <rect x="-46" y="-9" width="8" height="18" rx="3" fill="#5a61b7" />
        </g>
      </g>
      <g transform="translate(330 350) rotate(4)">
        <g className="anim-float" style={{ animationDelay: '2.2s, 2.2s' }}>
          <rect x="-40" y="-8" width="80" height="16" rx="4" fill="#c6cdf0" />
          <rect x="-40" y="-8" width="7" height="16" rx="3" fill="#4a509e" />
        </g>
      </g>
      <g transform="translate(222 362) rotate(-2)">
        <rect x="-52" y="-8" width="104" height="16" rx="4" fill="#f4f1ea" opacity="0.9" />
        <rect x="-52" y="-8" width="9" height="16" rx="3" fill="#a6b0e4" />
      </g>
    </svg>
  )
}
