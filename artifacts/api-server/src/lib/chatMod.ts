/**
 * Chat moderation filter — scans public messages for:
 *  - NSFW / explicit content
 *  - Targeted harassment patterns
 *  - Spam signals (excessive caps, repeated characters, flooding keywords)
 *
 * Returns a verdict. The calling route decides whether to block or log.
 *
 * NOTE: This is a rule-based first pass. It intentionally errs on the side of
 * flagging for human review rather than false-blocking legitimate messages.
 */

export type ModVerdict =
  | { ok: true }
  | { ok: false; reason: string; severity: "low" | "medium" | "high" };

/** Patterns that indicate clearly inappropriate content */
const NSFW_PATTERNS = [
  /\b(porn|pornography|nude|naked|sex\s*tape|onlyfans|xxx|cock\b|pussy\b|fuck\s*you|cunt\b|nigger|faggot|tranny)\b/i,
];

/** Patterns for targeted harassment */
const HARASSMENT_PATTERNS = [
  /\b(kys|kill\s*your\s*self|go\s*die|i\s*will\s*find\s*you|i\s*know\s*where\s*you\s*live)\b/i,
  /\b(doxx|dox|swat)\b/i,
];

/** Spam signals */
function isSpam(content: string): boolean {
  // More than 60% uppercase (and message is > 10 chars)
  if (content.length > 10) {
    const letters = content.replace(/[^a-zA-Z]/g, "");
    if (letters.length > 6 && (letters.replace(/[^A-Z]/g, "").length / letters.length) > 0.7) return true;
  }
  // Repeated characters: e.g. "aaaaaaa" — 6+ same char in a row
  if (/(.)\1{5,}/.test(content)) return true;
  // More than 4 exclamation marks / question marks
  if ((content.match(/[!?]/g) ?? []).length > 4) return true;
  // Link spam (non-game URLs)
  if (/https?:\/\//i.test(content)) return true;
  return false;
}

export function scanMessage(content: string): ModVerdict {
  for (const pat of NSFW_PATTERNS) {
    if (pat.test(content)) return { ok: false, reason: "nsfw_content", severity: "high" };
  }
  for (const pat of HARASSMENT_PATTERNS) {
    if (pat.test(content)) return { ok: false, reason: "harassment", severity: "high" };
  }
  if (isSpam(content)) return { ok: false, reason: "spam", severity: "medium" };
  return { ok: true };
}
