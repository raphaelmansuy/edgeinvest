// One rule table for the static source lint (tools/copy-lint.ts) and the rendered Playwright lint (docs/12 §5).
export interface CopyRule {
  id: "CP-CTA" | "CP-GUAR" | "CP-VOICE" | "CP-YIELD" | "CP-BLEND" | "CP-CASINO" | "CP-ADVICE";
  pattern: RegExp;
  scope: "cta" | "text";
  /** Phrases that neutralise a match when they contain it (e.g. "not a guarantee"). */
  allowWithin?: RegExp;
  message: string;
}

export const COPY_RULES: readonly CopyRule[] = [
  { id: "CP-CTA", scope: "cta", pattern: /^\s*(sell|buy|trade|submit|earn)\b/i,
    message: "Buttons never say sell/buy/trade/submit/earn. Use 'Prepare draft' or 'Open IB preview coach'." },
  { id: "CP-GUAR", scope: "text", pattern: /\b(risk[- ]free|guaranteed?( income)?|IB has no risk|sure thing)\b/i,
    allowWithin: /\bnot (a )?guarantee(d)?\b|\bno guarantee\b|never guaranteed|guaranteed\?|"risk-free"|not risk[- ]free|never risk[- ]free/i,
    message: "No guarantees or 'risk-free' claims." },
  { id: "CP-VOICE", scope: "text", pattern: /\b(we|our)\s+(fund|LPs?|AUM|capital|clients|manage)\b/i,
    message: "Personal book voice: 'you' / 'I', never a firm 'we'." },
  { id: "CP-BLEND", scope: "text", pattern: /\b(total|combined|blended)\s+(yield|return)\b/i,
    message: "Premium and T-bill legs are shown separately; never a blended yield." },
  { id: "CP-CASINO", scope: "text", pattern: /\b(jackpot|win big|lucky|streak bonus|beat the market|easy money)\b/i,
    message: "Anti-casino vocabulary." },
  { id: "CP-ADVICE", scope: "text", pattern: /\byou should (sell|buy|open|roll)\b/i,
    message: "No imperative advice." },
];

export interface CopyViolation { rule: CopyRule["id"]; match: string; context: string }

export function lintText(text: string, scope: "cta" | "text"): CopyViolation[] {
  const out: CopyViolation[] = [];
  for (const r of COPY_RULES) {
    if (r.scope !== scope) continue;
    const re = new RegExp(r.pattern.source, `${r.pattern.flags.replace("g", "")}g`);
    for (const m of text.matchAll(re)) {
      const start = Math.max(0, (m.index ?? 0) - 40);
      const context = text.slice(start, (m.index ?? 0) + m[0].length + 40);
      if (r.allowWithin?.test(context)) continue;
      out.push({ rule: r.id, match: m[0], context: context.replace(/\s+/g, " ").trim() });
    }
  }
  return out;
}

/** CP-YIELD (rendered only): a % near yield/return/income must sit inside a ClaimLabel subtree. */
export const YIELD_NEAR_PERCENT = /(\d+(\.\d+)?\s?%[^.\n]{0,40}\b(yield|return|income)\b)|(\b(yield|return|income)\b[^.\n]{0,40}\d+(\.\d+)?\s?%)/i;
