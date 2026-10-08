/**
 * Deterministic seeded shuffling for the review experience (PRD 24.1):
 * option order is shuffled per attempt and the shuffle_seed is stored on the
 * attempt so every screen for that attempt shows the same order. Pure and
 * dependency-free so it is trivially unit-testable (scripts/smoke-pipeline).
 */

/** FNV-1a string hash -> uint32. Stable across runs and platforms. */
export function hashStringToSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Combine two uint32 seeds into one (attempt seed + per-question hash, etc). */
export function combineSeeds(a: number, b: number): number {
  return (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) + Math.imul(b ^ 0xc2b2ae35, 0x27d4eb2f)) >>> 0
}

/** mulberry32: small, fast, well-distributed seeded PRNG in [0, 1). */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Fisher–Yates shuffle driven by a seed. Returns a new array; the input is
 * never mutated, so ordering stays reproducible for a given (items, seed).
 */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const out = items.slice()
  const rand = mulberry32(seed >>> 0)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}
