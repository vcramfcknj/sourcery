import { PIPELINE } from '../constants'
import type { CandidateWithContext } from './generate'
import { contentTokens, jaccard } from './text'

/**
 * L4 - DEDUPLICATION (PRD 18.1, Open Question #4 resolved to fact-key
 * comparison). Embeddings would need another provider and cost; a fact-key
 * over content tokens captures "same question, same answer fact" well enough
 * for an MVP and is fully deterministic and inspectable.
 *
 * Two candidates collide when their question+answer token sets are highly
 * similar. The threshold is stricter when they share the exact same source
 * chunk, because there we expect genuine near-duplicates rather than the same
 * fact phrased from different sections.
 */

interface FactKey {
  chunkId: string
  tokens: Set<string>
}

function factKey(c: CandidateWithContext): FactKey {
  // Fold the answer into the key so "What is X?" and "X is the ___" collide,
  // but two different answers about the same topic do not.
  const tokens = new Set([...contentTokens(c.candidate.question), ...contentTokens(c.candidate.correctAnswer)])
  return { chunkId: c.chunkId, tokens }
}

/** True if `candidate` duplicates any already-accepted fact key. */
function duplicatesAny(candidate: CandidateWithContext, acceptedKeys: FactKey[]): boolean {
  const key = factKey(candidate)
  if (key.tokens.size === 0) return false
  for (const ak of acceptedKeys) {
    if (ak.tokens.size === 0) continue
    const threshold =
      ak.chunkId === candidate.chunkId
        ? PIPELINE.DEDUPE_SAME_CHUNK_SIMILARITY
        : PIPELINE.DEDUPE_SIMILARITY
    if (jaccard(key.tokens, ak.tokens) >= threshold) return true
  }
  return false
}

/**
 * Filter a validated batch down to a de-duplicated set, in order. Returns the
 * survivors plus their fact keys so the caller can keep a running accepted set
 * across coverage buckets.
 */
export function dedupeBatch(
  candidates: CandidateWithContext[],
  alreadyAccepted: FactKey[] = [],
): { kept: CandidateWithContext[]; acceptedKeys: FactKey[] } {
  const kept: CandidateWithContext[] = []
  const acceptedKeys: FactKey[] = [...alreadyAccepted]
  for (const c of candidates) {
    if (duplicatesAny(c, acceptedKeys)) continue
    kept.push(c)
    acceptedKeys.push(factKey(c))
  }
  return { kept, acceptedKeys }
}

export type { FactKey }
