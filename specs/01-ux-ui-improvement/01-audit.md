# 01 · Audit

> Against the [frontend-design skill](../../.cursor/skills/frontend-design/SKILL.md) cluster of AI/templated tells.
> Brief: [00-brief](00-brief.md). Direction that replaces these: [02-direction](02-direction.md).

Each finding names the skill tell, the file, and the screen. Behaviour is fine; the skin is the problem.

---

## Summary

The product already behaves like a calm decision desk ([docs/06](../../docs/06-ui-design-system.md)). The skin matches the skill's **SaaS-card kit** plus **template chrome**: system/Inter sans, slate + `#1D4ED8`, identical rounded cards, gradient logo with one accented word, uppercase eyebrows, middle-dot metadata, trailing arrows on links.

---

## Findings

### F1 · Gradient logo + accented brand fragment

| | |
|--|--|
| Skill tell | Template chrome; accenting one word in a headline |
| File | [`packages/ui/src/chrome.tsx`](../../packages/ui/src/chrome.tsx) `Logo` |
| Screens | All (header + sign-in) |
| Evidence | Sparkline tile with `linearGradient`; wordmark renders `Edge<span className="text-accent">Invest</span>` |

### F2 · Uppercase tracked eyebrows

| | |
|--|--|
| Skill tell | Tracked-out ALL-CAPS eyebrow above every heading |
| File | [`packages/ui/src/primitives.tsx`](../../packages/ui/src/primitives.tsx) `CardHeader`, `PageHeader`, `Stat` |
| Screens | Home SCR-000, every `Screen` |
| Evidence | `tracking-wide … uppercase` on eyebrow and Stat labels |

### F3 · Home as four equal stats inside cards + "Next" eyebrow

| | |
|--|--|
| Skill tell | SaaS-card kit; unnecessary typographic labels; big-number-with-label default |
| File | [`apps/web/src/screens/home/home.tsx`](../../apps/web/src/screens/home/home.tsx) |
| Screen | SCR-000 |
| Evidence | `eyebrow="Home"`, `CardHeader eyebrow="Next"`, four `Stat` in a card grid; wheel and mastery also carded identically |

### F4 · Sign-in headline accents one phrase

| | |
|--|--|
| Skill tell | Accenting a single phrase in a headline |
| File | [`apps/web/src/screens/auth/sign-in.tsx`](../../apps/web/src/screens/auth/sign-in.tsx) |
| Screen | SCR-100 |
| Evidence | `Premium and discipline, <span className="text-accent">not a lottery ticket.</span>` |

### F5 · Blurred chrome + trailing arrow on halt

| | |
|--|--|
| Skill tell | Soft SaaS chrome; `→` appended to link text |
| File | [`apps/web/src/components/shell.tsx`](../../apps/web/src/components/shell.tsx) |
| Screens | Shell SCR-000, halt banner |
| Evidence | `bg-bg/85 backdrop-blur-md`; halt link ends with `→` |

### F6 · Middle-dot metadata on memos and as-of stamps

| | |
|--|--|
| Skill tell | Meta strings joined with middle dots (`A · B · C`) |
| Files | [`home.tsx`](../../apps/web/src/screens/home/home.tsx) memo rows; [`decision.tsx`](../../packages/ui/src/decision.tsx) `AsOfStamp` |
| Screens | SCR-000, ticket surfaces |
| Evidence | `"Cash-secured put" · {date}`; HKT `·` ET |

### F7 · DEFAULT / PAPER / HALT all-caps chips

| | |
|--|--|
| Skill tell | ALL-CAPS labels; tracked letter-spacing |
| File | [`packages/ui/src/chrome.tsx`](../../packages/ui/src/chrome.tsx) `EnvelopeBadge`, `ModeChip`, `HaltBanner`, `PaperBar` |
| Screens | Chrome row, Execute |
| Evidence | `DEFAULT`, `PAPER`, `LIVE · real money`, `HALT`, `tracking-[0.2em] uppercase` paper bar |

### F8 · Blue accent unrelated to the obligation

| | |
|--|--|
| Skill tell | Generic SaaS blue (could be any fintech) |
| File | [`apps/web/src/styles.css`](../../apps/web/src/styles.css) `--color-accent: #1d4ed8` |
| Screens | All |
| Evidence | After removing the nav, the first viewport could belong to another brand |

### F9 · Soft grey card shadow on everything

| | |
|--|--|
| Skill tell | Same soft grey shadow under each card |
| File | `styles.css` `--shadow-card`; `Card` in primitives |
| Screens | Home, Learn, Decide |
| Evidence | Identical `rounded-card border … shadow-card` for wheel, next, mastery, memos |

### F10 · HeroArt uses the obligation as a dashed footnote

| | |
|--|--|
| Skill tell | Boldness spent on a decorative sky gradient, not the subject |
| File | [`packages/ui/src/illustrations.tsx`](../../packages/ui/src/illustrations.tsx) `HeroArt` |
| Screen | SCR-100 |
| Evidence | Gradient wash + path; strike is a dashed red line with small text under the chart |

---

## What is already right (keep)

- Tabular money via `.num` and `MoneyText`
- Skip / Wait / Prepare equal size in `DecisionBar`
- Sticky / required compliance banner from the screen registry
- Halt and locked-loss as text + colour, not colour alone
- Phase, lots, reserved/leftover in chrome (information, not decoration)
- No broker submit path

---

## Severity for the build

| Priority | Findings | Action |
|----------|----------|--------|
| P0 | F1, F4, F5, F8 | Tokens + logo + sign-in + shell |
| P1 | F2, F3, F7, F9, F10 | Primitives, home, chrome chips, HeroArt, ticket rail |
| P2 | F6 | Prefer en-dash or stacked lines where layout allows; keep HKT/ET dual stamp |
