# 02 · Direction

> Token plan, then the anti-generic review required by the [frontend-design skill](../../.cursor/skills/frontend-design/SKILL.md).
> Brief: [00-brief](00-brief.md). Audit: [01-audit](01-audit.md). Wireframes: [03-wireframes](03-wireframes.md).

---

## One memorable device: the strike rail

A single horizontal rule. The three ticket numbers and the sentence "you may have to buy here" sit on it. Drawn once on the sign-in hero. Reduced motion shows it already drawn. Everything else stays quiet.

Spend the boldness there. Cut accessory decoration (Chanel).

---

## Color (4–6 named hex)

| Name | Light | Dark | Role |
|------|-------|------|------|
| Blotter | `#E4EAE8` | `#121614` | Page background (desk surface) |
| Sheet | `#F4F7F6` | `#1C2420` | Raised panels / cards |
| Ink | `#1B2421` | `#E4EBE7` | Body text |
| Quiet | `#5E6A66` | `#8A9792` | Secondary text |
| Strike | `#0F6E62` | `#7DCFC0` | Primary action and the rail |
| Loss | `#8E2F2F` | `#E07A7A` | Loss / live / blocked only |

Supporting (mapped to existing semantic tokens):

| Token | Light | Dark |
|-------|-------|------|
| `--color-bg` | Sheet `#F4F7F6` | Blotter dark `#121614` |
| `--color-surface` | Blotter `#E4EAE8` | `#1C2420` |
| `--color-raised` | `#FFFFFF` | `#1C2420` |
| `--color-ink` | Ink | Ink dark |
| `--color-muted` | Quiet | Quiet dark |
| `--color-accent` | Strike | Strike dark |
| `--color-accent-ink` | `#F4F7F6` | `#121614` |
| `--color-loss` | Loss | Loss dark |
| `--color-caution` | `#8A5A12` | `#E0B45A` |
| `--color-ok` | `#1F6B4A` | `#6BC49A` |
| `--color-banner` | `#F3EFE3` | `#1F1A0E` |
| `--color-hair` / `--color-line` / `--color-control` | cool grey-greens from blotter | muted desk greys |

Dark is a **dim desk**, not pure black and not an acid accent.

---

## Type

| Role | Family | Why |
|------|--------|-----|
| UI + body | Atkinson Hyperlegible | Failure mode is misreading a strike; designed for legibility |
| Obligation + page title | Literata | One serif for the sentence that matters; clearly distinct from UI |
| Figures | Atkinson tabular (`.num`) | Same family, tabular nums — not a third mono for labels |
| Mono | reserved for code / copies of passwords only | Not for labels |

Load via `@fontsource` (no runtime Google fetch). Prose line length under 80 characters. Left aligned.

---

## Layout

- Left aligned content. Max content width unchanged (~1400 chrome, ~md form on sign-in).
- Cards are sheets on blotter: quieter radius (`0.5rem` card, `0.375rem` control), hairline border, almost no shadow.
- Chrome is a solid blotter bar — no backdrop blur.
- Home: next action is a sentence + one button above a ruled stat row; wheel / mastery / memos are secondary.

---

## Principles

1. The rail is the only flourish.
2. Sentence case everywhere; no uppercase eyebrows.
3. No middle-dot metadata strings; use a line break or an en-dash when two facts sit together.
4. No trailing `→` on links.
5. No gradient logo; wordmark + short strike rule.
6. No accent on a single word inside a headline.
7. Primary = strike colour. Loss red keeps its role.
8. Skip and Prepare stay equal size ([docs/06](../../docs/06-ui-design-system.md)).

---

## Anti-generic review (before CSS)

| Temptation | Why rejected |
|------------|--------------|
| Warm cream `#F4F1EA` + terracotta / clay accent | Skill cluster #1; Anthropic tell; unrelated to a put obligation |
| Near-black + acid green or vermilion | Skill cluster #2; casino energy vs calm instrument |
| Broadsheet hairlines, zero radius, dense columns | Skill cluster #3; newspaper, not a desk blotter |
| Keep current blue `#1D4ED8` + soft card shadows | Skill cluster #4/#5; any fintech; fails the brand test |
| Inter / system sans + accented "Invest" | Default stack + accented fragment |
| Numbered 01/02/03 section markers on home | Content is not a sequence |

**What changed after this review:** strike green replaced "fintech blue"; blotter green-grey replaced slate; Literata limited to titles and the obligation line (not a cream-serif landing page); radius stayed small but not zero so controls stay touchable.

Only after this review is the build allowed ([04-build](04-build.md)).
