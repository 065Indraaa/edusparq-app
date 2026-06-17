/**
 * Output sanitizer for AI responses.
 *
 * Acts as the last line of defense against "weird symbols", decorative Unicode,
 * zero-width characters, and excessive emoji that LLMs sometimes emit despite
 * prompt instructions. Pure string transforms, zero dependencies, Edge-safe.
 *
 * Used by every AI route (chat, writing, tutor, research, exams, flashcards,
 * quiz, recommendations) right before returning text to the client.
 */

// Zero-width & invisible formatting characters the model sometimes injects.
const INVISIBLE_CHARS = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\u00AD]/g;

// Private-use area + decorative dingbats that pollute academic output.
const DECORATIVE_SYMBOLS = /[\uE000-\uF8FF\u2700-\u27BF\u2600-\u26FF\u2300-\u23FF]/g;

// Emoji blocks (pictographs, transport, flags, supplemental). Keep basic
// punctuation/symbols used in Markdown (bullets, arrows in code) untouched.
const EMOJI_BLOCKS = /[\u{1F000}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{27BF}]/gu;

// Collapse runs of 3+ identical chars like "....." or "----" decorations.
const RUN_DECORATION = /(.)\1{4,}/g;

// Stray replacement chars from bad encoding round-trips.
const REPLACEMENT_CHAR = /\uFFFD/g;

// Common mojibake sequences left by mis-encoded terminals ("Ã¢", "Ã©", "â€").
const MOJIBAKE = /[\u00C0-\u00C3\u00C8-\u00CB\u00CC-\u00CF\u00D2-\u00D6\u00D9-\u00DC][\u0080-\u00BF]+/g;

export interface SanitizeOptions {
  /** Strip markdown code fences the model may have wrapped around plain text. */
  stripCodeFences?: boolean;
  /** Trim leading/trailing quote chars the model may wrap around short outputs. */
  stripWrappingQuotes?: boolean;
  /** Collapse runs of identical decorative chars (default true). */
  collapseRuns?: boolean;
}

/**
 * Sanitize a single AI text output. Never throws; on any anomaly returns the
 * input trimmed.
 */
export function sanitizeOutput(
  input: string,
  opts: SanitizeOptions = {}
): string {
  let text = (input ?? "").toString();

  try {
    // 1. Remove invisible / zero-width chars.
    text = text.replace(INVISIBLE_CHARS, "");

    // 2. Normalize mojibake & replacement chars.
    text = text.replace(MOJIBAKE, "").replace(REPLACEMENT_CHAR, "");

    // 3. Strip decorative / private-use / emoji symbols.
    text = text.replace(DECORATIVE_SYMBOLS, "").replace(EMOJI_BLOCKS, "");

    // 4. Optionally collapse runs.
    if (opts.collapseRuns !== false) {
      text = text.replace(RUN_DECORATION, "$1$1$1");
    }

    // 5. Normalize whitespace: no tabs, collapse 3+ newlines, trim trailing spaces.
    text = text.replace(/\t/g, "  ");
    text = text.replace(/[ \t]+$/gm, "");
    text = text.replace(/\n{3,}/g, "\n\n");

    // 6. Optional: strip wrapping markdown fences.
    if (opts.stripCodeFences) {
      text = text
        .replace(/^```(?:[a-zA-Z]+)?\s*\n?/i, "")
        .replace(/\n?```\s*$/i, "");
    }

    // 7. Optional: strip wrapping quotes (for single-value outputs like titles).
    if (opts.stripWrappingQuotes) {
      text = text.replace(/^[""'']+|[""'']+$/g, "");
    }

    return text.trim();
  } catch {
    return (input ?? "").trim();
  }
}

/**
 * Sanitize a Markdown/HTML document body for the Writing Studio. Preserves
 * legitimate HTML tags & Markdown structure; only purges invisible/decorative
 * noise and balances trailing whitespace.
 */
export function sanitizeDocumentBody(input: string): string {
  return sanitizeOutput(input, { collapseRuns: false });
}
