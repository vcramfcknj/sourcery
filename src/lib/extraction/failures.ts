/**
 * Actionable failure copy for extraction/quality problems (Phase 6, PRD 35
 * fixtures). Pure + dependency-light so the smoke suite can test every
 * branch. The principle: never just say "failed" — say WHAT we detected and
 * WHAT the user can do next (PRD 29.4), without ever blaming the user.
 */
import { QUALITY } from '../constants'
import type { QualityReport } from './text-quality'

/** Turn a failed quality report into the most specific diagnosis we have. */
export function describeQualityFailure(
  quality: QualityReport,
  pageCount: number | null,
  format: 'pdf' | 'docx',
): string {
  const tooLittleText = quality.charCount < QUALITY.MIN_USABLE_CHARS

  // A multi-page PDF with (almost) no text is the classic scanned-document
  // signature: image pages, no text layer. Name the cause and the fix.
  if (tooLittleText && format === 'pdf' && pageCount != null && pageCount >= 2) {
    return `This looks like a scanned or image-only PDF — no selectable text was found across its ${pageCount} page${pageCount === 1 ? '' : 's'}. Sourcery only generates from real text: re-export the file with OCR ("text is selectable") turned on, or upload the DOCX / typed version.`
  }

  if (tooLittleText) {
    return 'We could not extract enough text from this file — it appears to be empty or nearly empty. Sourcery needs actual written material to draw questions from, and it will never invent any.'
  }

  return 'The text we extracted looks too garbled to produce reliable questions — this usually means heavy equations, odd character encodings, or images standing in for text. Re-export the document as a standard text-based PDF or DOCX and try again.'
}

/** Map a thrown extraction error to a user-facing code + actionable message. */
export function describeExtractionError(err: unknown): { code: string; message: string } {
  const msg = err instanceof Error ? err.message : String(err)

  if (msg.startsWith('Unsupported file type')) {
    return {
      code: 'unsupported_type',
      message:
        'This file is not a real PDF or DOCX — its contents do not match its name. Photos and scans (JPG/PNG) are not supported yet: Sourcery grounds every answer in exact text, and images would break that promise. Export your material as a text-based PDF or DOCX instead.',
    }
  }
  // pdf.js raises PasswordException / "No password given" for encrypted files.
  if (/password|encrypted/i.test(msg)) {
    return {
      code: 'password_protected',
      message:
        'This PDF is password-protected, so we cannot read it. Open it in a PDF viewer, remove the password (export/save without security), and upload the unlocked copy.',
    }
  }
  return {
    code: 'extraction_failed',
    message:
      'We could not read this file — it may be corrupted or in a format the reader does not understand. Try opening it in a viewer, then re-export it as a PDF or DOCX and upload that copy.',
  }
}
