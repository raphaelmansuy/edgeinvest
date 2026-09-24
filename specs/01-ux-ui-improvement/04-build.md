# 04 · Build

> File order and quality floor. Direction locked in [02-direction](02-direction.md). Wireframes: [03-wireframes](03-wireframes.md).

---

## Order of work

Changing tokens and primitives restyles all 46 screens. Do not redraw each route.

| Step | Files | Outcome |
|------|-------|---------|
| 1 | `apps/web` deps: `@fontsource/atkinson-hyperlegible`, `@fontsource/literata` | Local fonts, no runtime Google fetch |
| 2 | [`apps/web/src/styles.css`](../../apps/web/src/styles.css) | Blotter palette; font families; `.num`; `strike-rail` utility; reduced-motion already present |
| 3 | [`packages/ui/src/primitives.tsx`](../../packages/ui/src/primitives.tsx) | Sentence-case eyebrows; quieter radius/shadow; Stat labels |
| 4 | [`packages/ui/src/chrome.tsx`](../../packages/ui/src/chrome.tsx) | Wordmark + short rail; Mode/Phase/Halt/Paper without ALL-CAPS theatre |
| 5 | [`packages/ui/src/illustrations.tsx`](../../packages/ui/src/illustrations.tsx) | HeroArt rail = obligation |
| 6 | [`packages/ui/src/decision.tsx`](../../packages/ui/src/decision.tsx) | `TicketThreeNumbers` on the rail; AsOf without middle-dot |
| 7 | [`apps/web/src/components/shell.tsx`](../../apps/web/src/components/shell.tsx) | Solid header; halt link without `→` |
| 8 | [`apps/web/src/components/kit.tsx`](../../apps/web/src/components/kit.tsx) | Page chrome inherits PageHeader changes |
| 9 | [`apps/web/src/screens/auth/sign-in.tsx`](../../apps/web/src/screens/auth/sign-in.tsx) | Headline without accent fragment |
| 10 | [`apps/web/src/screens/home/home.tsx`](../../apps/web/src/screens/home/home.tsx) | Sentence next-step + ruled stats |
| 11 | [`apps/web/src/screens/auth/dev-accounts.tsx`](../../apps/web/src/screens/auth/dev-accounts.tsx) | Secondary panel on blotter (no blue left stripe theatre) |

Copy in `@edge/copy`, routes, and guards: **unchanged**.

---

## Quality floor

| Check | Pass when |
|-------|-----------|
| Mobile | Sign-in and home usable at 390×844; practice list scrolls |
| Focus | `:focus-visible` uses strike colour; skip-to-content still works |
| Reduced motion | `prefers-reduced-motion: reduce` kills animations; rail appears fully drawn |
| Contrast | Ink on sheet and strike-on-sheet meet or beat the ratios already computed in [docs/06](../../docs/06-ui-design-system.md) (≥ 4.5:1 body, ≥ 3:1 UI) |
| Brand test | Remove the nav from the first viewport — still recognisable as EdgeInvest via rail + Literata title |
| Decision symmetry | Skip and Prepare still same `size="lg"` and grid weight |

---

## Visual review checklist

With `make dev` at http://127.0.0.1:5183:

1. Sign-in light desktop — rail visible, password shown, no accented headline fragment
2. Sign-in light 390px — practice accounts reachable
3. Home as Pat — next sentence + ruled stats; no "HOME" / "NEXT" caps
4. Put packet — three numbers on the rail; Skip = Prepare weight
5. Dark mode home — dim desk, strike readable, not acid
6. Fix what screenshots show before calling done

---

## Traceability

| Spec | Docs |
|------|------|
| Behaviour, IA | [docs/04](../../docs/04-ux-ia-flows.md) |
| SCR registry | [docs/05](../../docs/05-screens-wireframes.md) |
| Prior design system (behavioural rules kept) | [docs/06](../../docs/06-ui-design-system.md) |
| Skill | [`.cursor/skills/frontend-design`](../../.cursor/skills/frontend-design/SKILL.md) |
