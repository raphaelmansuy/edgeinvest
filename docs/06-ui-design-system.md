# 06 · UI Design System (UI + Front-end Designer lens)

> Tailwind CSS **4.3** (CSS-first config with `@theme`), React 19.3, no component framework. It is a small, owned kit in `packages/ui`.
> Contrast ratios below were **computed** (WCAG 2.x relative luminance) on 2026-09-23, not estimated.

---

## 1. WHY (visual lens)

The interface handles an obligation worth tens of thousands of dollars. It must feel like a **calm instrument panel**, not a trading game:
numbers are legible and aligned, risk is shown without drama, and nothing flashes, celebrates or hurries the user (FP-4, FP-8).

## 2. Visual principles

| Principle | Rule | Anti-pattern it prevents |
|-----------|------|--------------------------|
| Numbers are the hero | Tabular monospace figures, right-aligned, units visible | Misreading 640.20 vs 64,020 |
| Calm hierarchy | One accent hue; red only for loss/live/blocked; amber only for stale/caution | Casino palettes, green-for-premium dopamine |
| Symmetry of choice | Skip and Prepare share size and weight | "Dark pattern" buried Skip |
| Text beats colour | Every state has a word or icon as well as a colour | Colour-blind misreads |
| Density on desktop, clarity on phone | Tables on desktop; step cards on phone | Cramped mobile tables |

## 3. Tokens (Tailwind 4 `@theme`)

`apps/web/src/styles.css` is the only place colours, fonts and radii are defined. Components use the semantic utilities
(`bg-surface`, `text-ink`, `text-loss`…) and never raw palette names. A lint rule bans `text-red-*` and similar in `apps/web` and `packages/ui` (DRY).

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* surfaces & text (light) */
  --color-bg:        #FFFFFF;
  --color-surface:   #F8FAFC;
  --color-ink:       #0F172A;   /* 17.85:1 on bg */
  --color-muted:     #475569;   /*  7.58:1 */
  --color-line:      #94A3B8;   /* decorative dividers only (2.56:1) */
  --color-control:   #64748B;   /* input borders: 4.76:1 ≥ 3:1 non-text */

  /* semantics */
  --color-accent:    #1D4ED8;   /* 6.70:1 · Prepare draft, links */
  --color-loss:      #B91C1C;   /* 6.47:1 · loss slope, LIVE chip, blocked */
  --color-caution:   #B45309;   /* 5.02:1 · stale, warnings */
  --color-ok:        #047857;   /* 5.48:1 · rule passed (never "profit") */
  --color-banner:    #FFFBEB;   /* compliance banner background; ink on it 17.22:1 */

  /* type */
  --font-sans: ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif;
  --font-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;

  /* shape */
  --radius-card: 0.5rem;
  --radius-control: 0.375rem;
}

.dark {
  --color-bg:      #0B1120;
  --color-surface: #111827;
  --color-ink:     #E2E8F0;   /* 15.27:1 */
  --color-muted:   #94A3B8;   /*  7.34:1 */
  --color-control: #64748B;   /*  3.96:1 */
  --color-accent:  #60A5FA;   /*  7.41:1 */
  --color-loss:    #F87171;   /*  6.81:1 */
  --color-caution: #FBBF24;   /* 11.28:1 */
  --color-ok:      #34D399;   /*  9.79:1 */
  --color-banner:  #1F1A0E;
}

.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
```

| Token group | Values | Notes |
|-------------|--------|-------|
| Spacing | Tailwind default 0.25 rem scale | Cards use `p-4`, sections `gap-6` |
| Type scale | `text-sm` body in tables, `text-base` prose, `text-2xl` for the five numbers | Numbers never smaller than body |
| Breakpoints | `sm 640 · md 768 · lg 1024 · xl 1280` | Desktop layout from `lg` |
| Elevation | Border + 1 subtle shadow level | No glassmorphism |
| Motion | 150 ms ease-out for disclosure, none on numbers | `motion-reduce:` disables all |

## 4. Layout

```
 lg+ (desktop)                                                   < lg (phone, Execute)
 ┌──────────────────────────────────────────────┬───────────┐    ┌──────────────────────┐
 │ top nav (areas)                     [PAPER]  │           │    │ ≡  Execute   [PAPER] │
 ├──────────────────────────────────────────────┤  Agent    │    ├──────────────────────┤
 │ chrome row: phase · lots · reserved · env    │  drawer   │    │ phase · lots         │
 ├──────────────────────────────────────────────┤  360 px   │    ├──────────────────────┤
 │ content: 12-col grid, max 1200 px            │ (toggle)  │    │ step card 1          │
 │  ┌ numbers (col 1-7) ┐ ┌ context (8-12) ┐    │           │    │ step card 2          │
 │  └───────────────────┘ └────────────────┘    │           │    │ ...                  │
 ├──────────────────────────────────────────────┴───────────┤    ├──────────────────────┤
 │ compliance banner (sticky bottom)                        │    │ sticky action bar    │
 └──────────────────────────────────────────────────────────┘    │ banner               │
                                                                 └──────────────────────┘
```

## 5. Component inventory

Needs components are kept by name. New ones are marked ★. Each component lives in `packages/ui`, has a story-like fixture test,
and takes **domain values** (`Usd4`, typed enums), never pre-formatted strings, so formatting is DRY.

| Component | Props (key) | Behaviour & rules | A11y | Used on |
|-----------|-------------|-------------------|------|---------|
| `TicketThreeNumbers` | `inv: ShortPutInvariants \| CoveredCallInvariants \| null` | Renders reserve, max profit, break-even; `null` ⇒ dashes + disables the parent CTA via context | `<dl>`; each value has a label and unit | 004, 020, 031, 032, 038, 040, 041 |
| `WorstCaseLine` | `worstCase: Usd4` | Always directly under the three numbers on put tickets | Plain text, not colour-only | same |
| `BidAskStrip` | `quote \| null`, `asOf` | `null` ⇒ refusal text "No quote, refusing to invent one" and link to SCR-102 | `role="status"` | 031, 036, 040 |
| `EnvelopeBadge` | `envelopeId`, `override` | Beginner default; "(override)" suffix; Mentor only if eligible | Text label | chrome, 071 |
| `PhaseChip` | `phase` | Text "cash-put" / "shares-held" plus icon | First in focus order | chrome |
| `LotsMeter` | `open`, `max` | "Lots 0/1"; at max ⇒ caution colour + text "at limit" | `aria-label` full sentence | chrome |
| `ReservedLeftoverBar` | `reserved`, `leftover` | Two labelled segments; no percentages of "yield" | Text values present | chrome, 030 |
| `ComplianceBanner` | `scr` | Reads registry: `sticky` / `required`; shows `copy_version` | `role="note"` | all |
| `SkipDialog` | `memoId` | Reason select (8 codes from DB); `other` ⇒ note ≥ 3 chars | Focus trap, Esc closes | 031, 032, 036, 037 |
| `PrepareDraftButton` | `disabledReasons: string[]` | Label **Prepare draft**; disabled lists reasons in a tooltip **and** inline | `aria-describedby` reasons | 032, 037 |
| `OpenIbPreviewCoachButton` | `draftId` | Label **Open IB preview coach** | – | 038, 040, 043 |
| `BasisLockBanner` | `basis`, `strike` | `strike < basis` ⇒ locked-loss explanation + link SCR-045 | `role="alert"` when it appears | 036–038, 043 |
| `PutUiLock` | – | Full-page notice with three next actions | Heading level 1 | 039 |
| `HaltBanner` | `halt` | Chrome row; cause + one action | `aria-live="polite"` | chrome, 045 |
| `WillingnessCap` | `cap`, `targetFunded` | Computed values only, labelled "computed, not a promise" | – | 035 |
| ★ `DecisionBar` | `onSkip`, `onWait`, `prepare` | Renders `Skip → Wait → Prepare` in that DOM order, same size | Tab order = DOM order | 031, 032, 036, 037, 011 |
| ★ `ChecklistPanel` | `results: RuleResult[]` | Registry order; failing rules first; each links to its fix | List with pass/fail text | 041, 045 |
| ★ `AsOfStamp` | `at: Instant`, `staleAfter` | Shows HKT and ET; amber + "stale" text beyond window | `<time datetime>` | 030, 031, 102 |
| ★ `ClaimLabel` | `label: claim_label` | "illustrative (meeting)", "sourced simulation", "UNCONFIRMED" | Text | 022, 023, 032 |
| ★ `YieldStack` | `premiumYieldAnn`, `tbill: RateSnapshot` | Two separate legs (premium, T-bill) with their sources; **no total prop exists** (G15) | Text values + `ClaimLabel` | 031, 032, 022 |
| ★ `MoneyInput` | `value: Usd4`, `tick` | Strict parse (`parseUsd4`); rejects `1e3`, commas-as-decimal; tick check | `inputMode="decimal"`, error text linked | 004, 020, 102, 103 |
| ★ `MoneyText` | `value: Usd4`, `sign?` | One formatter for all money (USD, 2 dp, thin-space grouping) | – | everywhere |
| ★ `TypedConfirm` | `phrase` | Button enabled only when phrase matches exactly | Label states the phrase | 045, 071, 022 (fill_cash) |
| ★ `ModeChip` | `mode` | PAPER (slate) / LIVE (loss colour + text) | Text | chrome |
| ★ `StepCoach` | `steps[]` | Mobile step cards; each step has done/undo; no auto-advance | Checkbox semantics | 040, 043 |
| ★ `PayoffChart` | `inv`, `range` | SVG; flat profit line, loss slope; always paired with `DataTable` | `<figure>` + caption + table | 020, 004 |
| ★ `FanChart` | `quantiles[]` | p05–p95 bands, p50 line; no "expected" wording | Table alternative | 022 |
| ★ `DataTable` | TanStack Table v9 | Sorting, sticky header, virtualised > 200 rows | Native `<table>` semantics | 031, 033, 046, 050 |
| ★ `ProblemAlert` | `problem: ProblemDetails` | Title, detail, `traceId`; retry only for idempotent calls | `role="alert"` | all forms |
| ★ `AgentDrawer` | `scr`, `mode` | Streams text; shows tool chips + citations; offline state | `aria-live` off while streaming, summary at end | chrome, 060 |
| ★ `CitationChip` | `source` | Links to content chunk or result id | Link text = source title | 060, 041 |
| ★ `MasteryMeter` | `competency`, `status` | Text status + bar; locked shows the unlock path | – | 007 |
| ★ `EmptyState` | `teach`, `action` | Teaching sentence + one action | – | all lists |

```
 Composition on a ticket-like view (order is a contract, asserted in e2e):

 ┌ TicketThreeNumbers ───────────────────────────┐
 │ Reserve 65,000.00   Max profit 1,240.00       │
 │ Break-even 637.60                             │
 ├ WorstCaseLine ────────────────────────────────┤
 │ Worst case (QQQ → 0) 63,760.00                │
 ├ BidAskStrip ──────────────────────────────────┤
 │ Bid 12.40 × Ask 12.60 · as of 15:58 ET        │
 ├ score / rank (optional) ──────────────────────┤
 │ #1 · 0.0352                                   │
 ├ DecisionBar ──────────────────────────────────┤
 │ [ Skip ▾ ]    [ Wait ]    [ Prepare draft ]   │
 └───────────────────────────────────────────────┘
```

## 6. Feedback, motion and tone

| Event | Visual response | Never |
|-------|-----------------|-------|
| Correct computation | Inline "ok" + the restated capital at risk sentence | Confetti, sounds, streak counters |
| Skip recorded | Neutral toast "Skip recorded: premium_below_tbill" | "You missed…" |
| Draft blocked | `ChecklistPanel` expands; focus moves to the first failing rule | Shake animations |
| Halt raised | Chrome row slides in (150 ms, off with reduced motion) | Modal that traps the user |
| Live mode | Red LIVE chip + text in chrome | Hiding mode behind an icon |

## 7. Data visualisation rules

- Payoff: a flat line above the strike, a 45° loss slope below, and a break-even marker labelled with its value. The x-axis includes 0 so the worst case is visible.
- Distributions: show p05/p50/p95 and P(end < start). No single "expected return" number.
- Comparisons (T-bill / buy QQQ / CSP) use the same axis and scale. Colour is supplemented with direct labels.
- Every chart has a `<table>` alternative and a one-line text summary (screen readers and copy-paste).
- Libraries: `d3-scale` 4.0.2 and `d3-shape` 3.2.0 for maths only. React renders the SVG (small, no chart framework lock-in).

## 8. Front-end design checklist (Definition of Done for any UI PR)

- [ ] Uses semantic tokens only; no raw palette classes (lint).
- [ ] Money uses `MoneyText` / `MoneyInput`; no ad-hoc `toFixed`.
- [ ] Loading, empty, error, blocked and stale states implemented ([04 §6](04-ux-ia-flows.md#6-states-every-screen-must-design-test-fixture)).
- [ ] Keyboard path works; focus visible (2 px accent ring, 3:1 against the background).
- [ ] Axe clean in Playwright; reduced-motion honoured.
- [ ] Copy strings come from `packages/copy`; copy lint passes ([12 §5](12-compliance-copy.md#5-copy-lint-rules-ci)).

---

## Cross-references

[04 UX flows](04-ux-ia-flows.md) · [05 Wireframes](05-screens-wireframes.md) · [08 Front-end](08-frontend-architecture.md) ·
[12 Copy](12-compliance-copy.md) · [18 Tailwind refs](18-references.md#1-stack-versions-verified-2026-09-23)
