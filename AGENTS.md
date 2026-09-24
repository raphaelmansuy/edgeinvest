# AGENTS.md — EdgeInvest

Guidance for coding agents working in this repo. Behavioural product rules live in [`docs/`](docs/); this file is the operational map.

## Product stance (do not violate)

- Education and decision support only. **No broker connection. No submit button. Ever.**
- The user may have to buy 100 shares at the strike. That obligation is the product.
- Server decides gates via `capabilities`; the UI reflects them. Do not invent client-side unlocks.
- Skip and Prepare share size and weight. Numbers are the hero. Text beats colour for state.
- Copy strings live in `@edge/copy` / the compliance registry — do not invent disclaimer wording.
- Do not edit `Needs/` or `.vscode/`. Prefer `docs/` + code.

## Stack and layout

| Layer | Path | Notes |
|-------|------|--------|
| Web | `apps/web` | React 19, TanStack Router/Query, Tailwind 4 |
| API | `apps/api` | Hono, hexagonal `usecases` + adapters, zod |
| Worker | `apps/worker` | Embeddings / background jobs |
| UI kit | `packages/ui` | Shared primitives, chrome, ticket, illustrations |
| Domain / contracts / copy | `packages/{domain,contracts,copy,content,sim}` | |
| Screens | 46 SCR ids in `packages/contracts/src/screens.ts` | Routes mirror `docs/05` |
| Migrations | `db/migrations` | Postgres 18 |

## Local development

```bash
make dev      # DB (this project only) + API + worker + web
make stop
make status
make logs
make audit    # desktop-light screenshots + axe for every SCR
```

Ports come from `.env` (defaults in `.env.example` may differ). Typical local values used by the audit tool:

- Web `WEB_ORIGIN` / `WEB_PORT` → `http://127.0.0.1:5183`
- API `API_ORIGIN` / `API_PORT` → `http://127.0.0.1:8797`
- DB on a non-default host port so other Docker DBs are left alone

`make dev` sets `DEV_SIGNIN=1`. Practice accounts appear on `/sign-in` (password `paper-wheel-2026`). Personas: `e2e/fixtures/dev-accounts.ts`.

Do not start or stop unrelated Docker containers.

## UX / UI system (strike rail)

Visual redesign specs (behaviour unchanged):

| Spec | Purpose |
|------|---------|
| [`specs/01-ux-ui-improvement/00-brief.md`](specs/01-ux-ui-improvement/00-brief.md) | Scope and inherited rules |
| [`01-audit.md`](specs/01-ux-ui-improvement/01-audit.md) | Before/after critique |
| [`02-direction.md`](specs/01-ux-ui-improvement/02-direction.md) | Tokens, type, anti-generic review |
| [`03-wireframes.md`](specs/01-ux-ui-improvement/03-wireframes.md) | ASCII wireframes |
| [`04-build.md`](specs/01-ux-ui-improvement/04-build.md) | Implementation checklist |
| [`05-screenshot-a11y-audit.md`](specs/01-ux-ui-improvement/05-screenshot-a11y-audit.md) | Generated axe report |

Skill: [`.cursor/skills/frontend-design/SKILL.md`](.cursor/skills/frontend-design/SKILL.md).

Memorable device: **strike rail** — one horizontal rule carrying the three ticket numbers and “you may have to buy here.” Tokens and type:

- Atkinson Hyperlegible (UI + `.num` tabular figures) + Literata (page titles / obligation)
- Accent teal `#0F6E62` (light) / `#7DCFC0` (dark); muted text must stay WCAG-safe (`--color-muted` ≥ `#3f4a46` light)
- Tokens in `apps/web/src/styles.css`; primitives in `packages/ui`

When changing visuals: shared kit first so all SCR screens inherit. Do not change routes, CTA verbs, or approved copy.

## Accessibility and keyboard (required)

Kit expectations (keep these working):

- Visible `:focus-visible` rings (accent) on controls, links, SubNav, Tabs
- Skip link: shell (`#main`) and sign-in (`#sign-in-form`)
- SubNav: ArrowLeft/Right, Home, End
- Tabs: arrow keys + roving `tabIndex`
- Dialog: focus first control on open; Escape/`cancel` closes; restore focus to opener
- Account menu: ArrowUp/Down/Home/End; Escape restores trigger; outside click closes
- Fields: `aria-describedby` / `aria-invalid` on the control
- Prefer `div` grids for stats — avoid nested `dl`/`dt`/`dd` that fail axe `definition-list` / `listitem`
- Sticky compliance banner: leave content bottom padding (`pb-24`) so primary actions are not covered
- `scroll-padding-top/bottom` on `html` for sticky chrome
- `prefers-reduced-motion` respected; no motion on monetary numbers

Cycle state for assignment is `short_put_open` (domain), not `short_put`.

## Screenshot + axe audit

With `make dev` running:

```bash
make audit
# or: bun run tools/screenshot-audit.ts
```

- Captures `docs/e2e/screenshots/SCR-*-desktop-light.png` (46 screens)
- Writes/overwrites `specs/01-ux-ui-improvement/05-screenshot-a11y-audit.md`
- Persona cookies from `e2e/fixtures/dev-accounts.ts`; SCR→persona map in `tools/screenshot-audit.ts`
- Target: **0 axe findings**, including serious/critical

After UI kit or screen polish, re-run `make audit` before claiming a11y done. Sticky banners can appear mid-page in full-page PNGs (Playwright stitch artifact); verify in a normal viewport when unsure.

## Checks agents should run

```bash
bun run lint
bun x tsc -p apps/web --pretty false --noEmit
bun run test          # packages
# optional: bun run test:int  (needs DB)
make audit            # after UX/a11y changes
```

## Commits and scope

- Commit only when the user asks.
- Prefer small, epic-aligned changes; do not expand into unrelated refactors.
- Never commit `.env` or secrets.
