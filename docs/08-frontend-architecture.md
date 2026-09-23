# 08 · Front-end Architecture (Full-stack Developer lens)

> Vite 8.3 SPA · React 19.3 · TanStack Router 1.170 (file routes, auto code splitting) · Query 5.103 · Form 1.33 · Table 9.2 ·
> Tailwind 4.3. Rendering is client-only (TanStack Start is still RC; SSR adds nothing for a single-user local tool; [ADR-002](17-adr.md#adr-002-vite-spa-with-tanstack-router-not-tanstack-start-or-nextjs)).

---

## 1. WHY (front-end lens)

The front end must **never be the place where a safety decision is made**. It shows what the server decided (capabilities, rule results,
halt), makes the right action easy, and keeps no hidden state that could drift from the database (principle 12 in [04 §2](04-ux-ia-flows.md#2-principles-needs-110-plus-four-we-add)).

## 2. Build configuration

```ts
// apps/web/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }), // must come before react()
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    proxy: { '/api': { target: process.env.API_PROXY_TARGET ?? 'http://localhost:8787' } },
  },
})
```

Same-origin via the proxy means the session cookie is first-party. CSP `connect-src 'self'` holds. There is no CORS configuration to get wrong.

## 3. Route tree

File-based routes under `apps/web/src/routes/`. `_app` is a **pathless layout** (the shell, SCR-000), so its segment does not appear in URLs.

```
routes/
├─ __root.tsx                         createRootRouteWithContext<{ queryClient }>
├─ sign-in.tsx                        SCR-100  (public)
├─ _app.tsx                           SCR-000  beforeLoad: capabilities → authenticated / onboarded
└─ _app/
   ├─ welcome.tsx                     SCR-101
   ├─ learn/
   │  ├─ why.tsx  seven-words.tsx  three-layer.tsx  arithmetic.tsx  wheel.tsx     SCR-001…005
   │  ├─ quizzes.$module.tsx          SCR-006
   │  └─ game/
   │     ├─ index.tsx                 SCR-007
   │     ├─ tutorial.tsx              SCR-008
   │     ├─ scenario.$scenarioId.tsx  SCR-009
   │     ├─ crash.$scenarioId.tsx     SCR-010
   │     ├─ committee.tsx             SCR-011
   │     └─ post-assign.tsx           SCR-012
   ├─ simulate/ payoff.tsx crash.tsx monte-carlo.tsx backtest.tsx               SCR-020…023
   ├─ decide/
   │  ├─ inputs.tsx                   SCR-102
   │  ├─ snapshot.tsx                 SCR-030
   │  ├─ candidates.tsx               SCR-031
   │  ├─ packet.$memoId.tsx           SCR-032
   │  ├─ history.tsx                  SCR-033
   │  ├─ assignment.$cycleId.tsx      SCR-034
   │  ├─ willingness.tsx              SCR-035
   │  ├─ call-candidates.tsx          SCR-036
   │  ├─ call-packet.$memoId.tsx      SCR-037
   │  ├─ call-ticket.$draftId.tsx     SCR-038
   │  └─ put-lock.tsx                 SCR-039
   ├─ execute/
   │  ├─ put-playbook.$draftId.tsx    SCR-040
   │  ├─ draft-coach.$draftId.tsx     SCR-041
   │  ├─ human-gate.$draftId.tsx      SCR-042
   │  ├─ short-put-life.$cycleId.tsx  SCR-103
   │  ├─ call-playbook.$draftId.tsx   SCR-043
   │  ├─ short-call-life.$cycleId.tsx SCR-044
   │  ├─ halt.tsx                     SCR-045
   │  └─ quarterly-ledger.tsx         SCR-046
   ├─ journal/ audit.tsx tax-hk.tsx lessons.tsx                                 SCR-050…052
   ├─ agent.tsx                       SCR-060
   └─ me/ settings.tsx envelope.tsx mode.tsx compliance.tsx                     SCR-070…073
```

A unit test asserts that the generated route tree and `packages/contracts/screens.ts` list exactly the same 46 routes (EC-UX-004).

## 4. Guards: capabilities drive routes

```
 navigation ─► _app.beforeLoad ─► ensureQueryData(['me','capabilities'])  (staleTime 30 s)
                 │  !authenticated ─► redirect /sign-in?redirect=…
                 │  !onboarded     ─► redirect /welcome
                 ▼
               leaf.beforeLoad = guardFor('SCR-xxx')  ─► reads SCREENS[scr].guard
                 │  capability false ─► redirect to the registry's fallback (e.g. SCR-039 for puts)
                 ▼
               leaf.loader ─► ensureQueryData(screen data)  ─► component renders
```

```tsx
// apps/web/src/routes/__root.tsx
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => <Outlet />,
})

// apps/web/src/routes/_app.tsx
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    const caps = await context.queryClient.ensureQueryData(capabilitiesQuery())
    if (!caps.authenticated) throw redirect({ to: '/sign-in', search: { redirect: location.href } })
    if (!caps.onboarded && location.pathname !== '/welcome') throw redirect({ to: '/welcome' })
    return { caps }
  },
  component: AppShell,
})

// apps/web/src/lib/guard.ts: one guard function for every screen (DRY)
export const guardFor = (scr: ScrId) => ({ context }: { context: { caps: Capabilities } }) => {
  const { guard, fallback } = SCREENS[scr]
  if (guard !== 'onboarded' && !context.caps[guard]) throw redirect({ to: fallback })
}

// apps/web/src/routes/_app/decide/packet.$memoId.tsx
export const Route = createFileRoute('/_app/decide/packet/$memoId')({
  beforeLoad: guardFor('SCR-032'),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(memoQuery(params.memoId)),
  component: PacketScreen,
})
```

Mutations that can change capabilities (ack disclosure, fill, assignment, called away, mastery evidence, halt raise/clear, mode or envelope change)
invalidate `['me','capabilities']` and call `router.invalidate()`, so guards re-run immediately (EC-UX-005).

## 5. State ownership (one owner per piece of state)

| State | Owner | Examples | Rule |
|-------|-------|----------|------|
| Server truth | TanStack Query cache | memos, drafts, capabilities, wheel state | Never copied into component state; derived with `select` |
| URL state | Router search params, validated by Zod (`validateSearch`) | filters on SCR-033/050, selected candidate id | Shareable and back-button safe |
| Form state | TanStack Form | inputs on SCR-102, fill on SCR-103, plan text | Validators are the **same Zod schemas** the API uses |
| Ephemeral UI | `useState` local | drawer open, dialog open | Not persisted |
| Global client store | **none** | – | Avoids a second source of truth |

## 6. Data access

```ts
// apps/web/src/lib/api.ts: typed client from the Hono app type (no hand-written fetch wrappers)
import { hc } from 'hono/client'
import type { AppType } from '@edge/api/app'
export const api = hc<AppType>('/api/v1', {
  headers: () => ({ 'X-CSRF': '1' }),
  init: { credentials: 'same-origin' },
})

// query key factory: the only place keys are spelled
export const qk = {
  caps: ['me', 'capabilities'] as const,
  memo: (id: string) => ['memo', id] as const,
  memos: (f: MemoFilter) => ['memos', f] as const,
  draft: (id: string) => ['draft', id] as const,
  wheel: ['wheel', 'state'] as const,
  audit: (cursor?: string) => ['audit', cursor] as const,
}
```

| Mutation | Idempotency key | Invalidates |
|----------|-----------------|-------------|
| Save inputs snapshot | per submit intent | `latest snapshot`, `caps` (fx_loan / level may halt) |
| Attach stress | per (memo, kind, resultId) | `memo(id)` |
| Skip / decide memo | per memo | `memo(id)`, `memos` |
| Prepare draft | per memo intent | `memo(id)`, `draft(new)` |
| Human gate / fill / lifecycle event | per draft or cycle intent | `draft`, `wheel`, `caps`, ledger |
| Halt clear / locked-loss accept | per intent | `wheel`, `caps`, `draft` |

One key per **user intent**: generated when the form opens, reused on retry, replaced after success. A double click or a retried
network request therefore replays instead of duplicating (EC-UX-006).

## 7. Forms (TanStack Form + shared Zod)

```tsx
const form = useForm({
  defaultValues: { price: '', filledAt: '' },
  validators: { onChange: RecordFillSchema },           // same schema as the API route (packages/contracts)
  onSubmit: async ({ value }) => recordFill.mutateAsync(value),
})
```

- `MoneyInput` wraps a field and uses `parseUsd4`. Validation errors are shown inline and linked with `aria-describedby`.
- Server problem+json `errors[]` (field pointers) are mapped back onto fields. There is one mapping helper.

## 8. Tables (TanStack Table v9)

Used for candidates (SCR-031/036), memo history (SCR-033), ledger (SCR-046) and audit (SCR-050). Column definitions live next to the
screen. Cells render `MoneyText` and domain enums only. Rejected candidate rows stay visible with their reasons and are sorted after ranked rows.
Virtualisation (`@tanstack/react-virtual`) turns on above 200 rows (audit log).

## 9. Agent drawer streaming

```
 POST /api/v1/agent/chat  (text/event-stream)
   event: token      data: {"t":"Buying a put pays"}
   event: tool       data: {"name":"calc_invariants","args":{…},"resultRef":"…"}
   event: citation   data: {"source":"M1#bid-ask","title":"Seven words"}
   event: policy     data: {"flag":"refuse_advice"}
   event: done       data: {"messageId":"…","status":"ok"}
```

Consumed with `fetch` + `TextDecoderStream`, cancellable with `AbortController` when the drawer closes (EC-AG-011). Tokens are appended to
local state only; the persisted transcript is re-fetched on `done`.

## 10. Errors and resilience

- Route-level `errorComponent` renders `ProblemAlert` with `traceId`. The root has a last-resort boundary that says "Nothing was sent to any broker".
- Query retries: 2 for GETs on network errors only; **0** for mutations. Idempotency makes manual retries safe instead.
- Offline (`navigator.onLine === false` or fetch TypeError): the banner shows, mutations are disabled, and cached reads stay visible.

## 11. Performance

- `autoCodeSplitting` gives one chunk per route. `defaultPreload: 'intent'` preloads on hover or focus.
- Simulation charts are lazy components. Monte Carlo results render from the server summary, so the client never holds 10k paths.

## 12. Front-end tests

| Level | Tool | What |
|-------|------|------|
| Unit | `bun test` | formatters, guards (`guardFor` against the registry), query-key factory |
| Component | `bun test` + happy-dom | `TicketThreeNumbers` null ⇒ CTA disabled; `DecisionBar` DOM order |
| E2E | Playwright 1.63 | journeys, registry sweep, axe ([14 §5](14-test-strategy.md#5-end-to-end-playwright)) |

---

## Cross-references

[04 Gates](04-ux-ia-flows.md#5-gates-and-locks) · [05 Registry](05-screens-wireframes.md#1-screen-registry) · [06 Components](06-ui-design-system.md#5-component-inventory) ·
[07 API](07-architecture.md#6-api-surface) · [11 Agent streaming](11-agent-llm.md) · [18 TanStack refs](18-references.md#2-official-documentation-consulted)
