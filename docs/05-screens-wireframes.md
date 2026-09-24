# 05 · Screens & Wireframes (UX + UI lens)

> All **46** screens: 42 unique IDs from [`Needs/4 UX`](../Needs/4%20UX%20IA%20wireframes/ux.md) plus `SCR-100..103`
> ([01 §9](01-product-spec.md#9-gap-analysis-of-needs), G2/G3/G8/G9). Wireframes are **structure, order and copy**, not pixels.
> Visual rules: [06](06-ui-design-system.md). Flows: [04](04-ux-ia-flows.md). The registry below is also code: `packages/contracts/screens.ts`.

---

## WHY (screens lens)

Each wireframe fixes three things that tests will assert: **the order** (five numbers before any score, Skip before Prepare),
**the words** (CTA verbs, disclaimers), and **the blocked states** (what the user sees when a rule fails).
Numbers in the wireframes reuse the worked examples in [02 §3](02-investment-domain.md#3-worked-examples-these-exact-numbers-are-test-fixtures)
where possible. The rest are placeholders; they are not market data.

**Running example used below:** spot 721.11; `SELL 1 QQQ 650 P Dec-18-2026` (86 DTE on the ET calendar from 2026-09-23); bid 12.40;
filled at 12.35; assigned; decision basis 637.65; then `SELL 1 QQQ 640 C Mar-19-2027` at 9.10; called away.

## 1. Screen registry

The single registry drives routes, guards, banners and e2e coverage (DRY). An e2e test iterates it, visits every route, runs axe and
checks the banner rule ([14 §5](14-test-strategy.md#5-end-to-end-playwright)).

| SCR | Name | Route | Area | Guard (capability) | Banner | Stories |
|-----|------|-------|------|--------------------|--------|---------|
| SCR-100 | Sign in | `/sign-in` | Auth | `public` | footer | AUTH-1 |
| SCR-101 | First run | `/welcome` | Auth | `authenticated` | sticky | AUTH-1 |
| SCR-000 | App shell | `/_app` | Shell | `authenticated` | sticky | US-2, US-5 |
| SCR-001 | Learn › WHY | `/learn/why` | Learn | `onboarded` | sticky | – |
| SCR-002 | Learn › Seven words | `/learn/seven-words` | Learn | `onboarded` | sticky | US-1 |
| SCR-003 | Learn › Three-layer | `/learn/three-layer` | Learn | `onboarded` | sticky | US-2 |
| SCR-004 | Learn › CSP arithmetic | `/learn/arithmetic` | Learn | `onboarded` | sticky | US-1 |
| SCR-005 | Learn › Wheel | `/learn/wheel` | Learn | `onboarded` | sticky | US-4 |
| SCR-006 | Learn › Quizzes | `/learn/quizzes/$module` | Learn | `onboarded` | sticky | US-1 |
| SCR-007 | Game hub | `/learn/game` | Game | `onboarded` | sticky | US-1, US-3 |
| SCR-008 | Game › Tutorial | `/learn/game/tutorial` | Game | `onboarded` | sticky | US-1 |
| SCR-009 | Game › Scenario | `/learn/game/scenario/$id` | Game | `onboarded` | sticky | US-1 |
| SCR-010 | Game › Crash | `/learn/game/crash/$id` | Game | `onboarded` | sticky | US-3 |
| SCR-011 | Game › Committee | `/learn/game/committee` | Game | `onboarded` | sticky | US-7 |
| SCR-012 | Game › Post-assign | `/learn/game/post-assign` | Game | `onboarded` | sticky | US-8 |
| SCR-020 | Simulate › Payoff | `/simulate/payoff` | Simulate | `onboarded` | sticky | US-1 |
| SCR-021 | Simulate › Crash | `/simulate/crash` | Simulate | `onboarded` | sticky | US-3 |
| SCR-022 | Simulate › Monte Carlo | `/simulate/monte-carlo` | Simulate | `onboarded` | sticky | US-3 |
| SCR-023 | Simulate › Backtest | `/simulate/backtest` | Simulate | `onboarded` | sticky | US-2, US-3 |
| SCR-102 | Decide › Inputs | `/decide/inputs` | Decide | `onboarded` | sticky | US-9 |
| SCR-030 | Decide › Snapshot | `/decide/snapshot` | Decide | `onboarded` | sticky | US-3, US-9 |
| SCR-031 | Decide › Candidates | `/decide/candidates` | Decide | `phase_cash_put` | sticky | US-1, US-2, US-7 |
| SCR-032 | Decide › Put packet | `/decide/packet/$memoId` | Decide | `phase_cash_put` | sticky | US-3, US-5, US-7, US-11 |
| SCR-033 | Decide › History | `/decide/history` | Decide | `onboarded` | sticky | US-7 |
| SCR-034 | Decide › Assignment | `/decide/assignment/$cycleId` | Share | `open short put` | sticky | US-8 |
| SCR-035 | Decide › Willingness | `/decide/willingness` | Share | `phase_shares_held` | sticky | US-8 |
| SCR-036 | Decide › Call candidates | `/decide/call-candidates` | Share | `phase_shares_held` | sticky | US-8 |
| SCR-037 | Decide › Call packet | `/decide/call-packet/$memoId` | Share | `phase_shares_held` | sticky | US-7, US-8 |
| SCR-038 | Decide › Call ticket | `/decide/call-ticket/$draftId` | Share | `phase_shares_held` | sticky | US-4, US-8 |
| SCR-039 | Decide › Put lock | `/decide/put-lock` | Share | `onboarded` | sticky | US-8 |
| SCR-040 | Execute › Put playbook | `/execute/put-playbook/$id` | Execute | `phase_cash_put` | required | US-4 |
| SCR-041 | Execute › Draft coach | `/execute/draft-coach/$id` | Execute | `onboarded` | required | US-5 |
| SCR-042 | Execute › Human gate | `/execute/human-gate/$id` | Execute | `onboarded` | required | US-5 |
| SCR-103 | Execute › Short-put life | `/execute/short-put-life/$id` | Execute | `open cycle` | required | US-10, US-11 |
| SCR-043 | Execute › Call playbook | `/execute/call-playbook/$id` | Execute | `phase_shares_held` | required | US-4 |
| SCR-044 | Execute › Short-call life | `/execute/short-call-life/$id` | Execute | `phase_shares_held` | required | US-8 |
| SCR-045 | Execute › Halt / veto | `/execute/halt` | Execute | `onboarded` | required | US-8 |
| SCR-046 | Execute › Quarterly ledger | `/execute/quarterly-ledger` | Execute | `onboarded` | sticky | US-6 |
| SCR-050 | Journal › Audit | `/journal/audit` | Journal | `onboarded` | sticky | US-5, US-7 |
| SCR-051 | Journal › HK tax | `/journal/tax-hk` | Journal | `onboarded` | sticky | US-6 |
| SCR-052 | Journal › Lessons | `/journal/lessons` | Journal | `onboarded` | sticky | US-1 |
| SCR-060 | Agent | `/agent` | Agent | `onboarded` | required | US-5, US-12 |
| SCR-070 | Me › Settings | `/me/settings` | Me | `authenticated` | sticky | – |
| SCR-071 | Me › Envelope | `/me/envelope` | Me | `onboarded` | sticky | US-2 |
| SCR-072 | Me › Mode | `/me/mode` | Me | `onboarded` | required (Live) | US-4, US-5 |
| SCR-073 | Me › Compliance | `/me/compliance` | Me | `authenticated` | sticky | US-6 |

Banner values: `sticky` = always present; may collapse to a one-line strip per session, never disappears; `required` = always visible and **not** dismissible;
`footer` = public page footer. Guard `open short put` / `open cycle` = the route's `$cycleId` must belong to the user and be in a
compatible state, otherwise 404 (EC-SEC-002).

```
 registry entry (packages/contracts/screens.ts)
 { id: 'SCR-032', route: '/decide/packet/$memoId', area: 'decide', guard: 'phase_cash_put',
   banner: 'sticky', disclosures: [], stories: ['US-3','US-5','US-7','US-11'] }
      │                     │                        │                 │
      ├─► router guard      ├─► ComplianceBanner     ├─► ack gate      └─► trace gate (docs/16)
```

## 2. Shell and authentication

### SCR-100 Sign in

```
+-- SCR-100 --------------------------------------------- /sign-in --+
| EdgeInvest: learn, simulate, decide. You submit in IBKR.           |
|                                                                    |
| Email     [______________________________________]                 |
| Password  [______________________________________]                 |
|                                                                    |
| [ Sign in ]                                                        |
|                                                                    |
| Wrong credentials: "Email or password is wrong" (never which one)  |
| 429: "Too many attempts. Try again in 12 min."                     |
| Education / decision support. Not investment advice.               |
+--------------------------------------------------------------------+
```

API `POST /auth/sign-in` · audit `session_started` · EC-SEC-001…004 · AUTH-1

### SCR-101 First run

```
+-- SCR-101 --------------------------------------------- /welcome --+
| Step 1 of 4 · WHY                                                  |
| "Before you sell a put you will be able to state reserve, max      |
|  profit, break-even, assignment risk and worst case, in words."    |
| Step 2 · Jurisdiction [ HK v ]   Voice: personal book              |
| Step 3 · Disclosures (copy v1)                                     |
|   [x] This is education, not investment advice       [ read ]      |
|   [x] Options can lose more than the premium         [ read ]      |
|   [x] This app never sends orders to any broker      [ read ]      |
| Step 4 · Paper lab start cash [ 100,000 ] USD                      |
|                                                                    |
| [ Back ]                                     [ Start with WHY ]    |
+--------------------------------------------------------------------+
```

API `POST /me/disclosures/:key/ack`, `PATCH /me` · capability `onboarded` · EC-CP-001 · AUTH-1

### SCR-000 App shell

```
+-- SCR-000 ------------------------------------------------ /_app --+
| Learn  Simulate  Decide  Execute  Journal  Agent  Me   [PAPER] (R) |
| ------------------------------------------------------------------ |
| [cash-put]  Lots 0/1  Reserved 0 · Leftover 100,000 USD            |
| Env: Beginner 5-12 % (DEFAULT)   Mentor: locked                    |
| (!) HALT banner row appears here only when halted (aria-live)      |
| ------------------------------------------------------------------ |
| content canvas                                    | Agent drawer   |
|                                                   | (toggle)       |
| ------------------------------------------------------------------ |
| Education / decision support: NOT investment advice.  copy v1      |
+--------------------------------------------------------------------+
```

API `GET /me/capabilities`, `GET /wheel/state` · components PhaseChip, LotsMeter, ReservedLeftoverBar, EnvelopeBadge, ModeChip, HaltBanner, ComplianceBanner · US-2, US-5

## 3. Learn

### SCR-001 Learn › WHY

```
+-- SCR-001 ------------------------------------------- /learn/why --+
| WHY THIS STRATEGY                                                  |
| Premium + discipline, not a lottery ticket.                        |
|                                                                    |
| You are paid now to promise to buy QQQ lower.                      |
| The promise is the risk: reserve = strike x 100, held in USD.      |
| The upside is small and frequent; the downside is rare and big.    |
|                                                                    |
| Reflect (not graded): "In one sentence, why would I do this?"      |
| [_______________________________________________________]          |
|                                   [ Continue: Seven words ]        |
+--------------------------------------------------------------------+
```

Content `M0` · no evidence (reflection) · FP-1

### SCR-002 Learn › Seven words

```
+-- SCR-002 ----------------------------------- /learn/seven-words --+
| SEVEN WORDS                                      progress 3/7      |
| [share] [put] [call] [strike] [premium] [expiry] [assignment]      |
|                                                                    |
| Card 3/7: STRIKE                                                   |
|   "The price at which you promise to buy (put) or sell (call)."    |
|   Check: a 650 put obliges you to buy at ___                       |
|          ( ) 721.11 spot   ( ) 650.00   ( ) 9.80                   |
| [ Flip ]  [ I knew it ]  [ I did not ]                             |
|                                                                    |
| Graded run (hints off): 6 of 7 needed                              |
| Next module locked until all 7 cards seen   [ Continue ]           |
+--------------------------------------------------------------------+
```

Evidence C-VOC-1 · content `M1` · EC-LN-002

### SCR-003 Learn › Three-layer

```
+-- SCR-003 ----------------------------------- /learn/three-layer --+
| THREE-LAYER OPERATING SYSTEM                                       |
|   Layer 3  Option overlay  short put / covered call   small        |
|   Layer 2  Treasury core   T-bills / idle USD         reserve      |
|   Layer 1  FX              HKD -> USD, deliberately   FIRST        |
|                                                                    |
| (!) HKD cash + USD put without converting = a USD LOAN             |
|     (any negative currency balance is a loan)                      |
|                                                                    |
| Meeting examples 3.13 % idle, 3.68 % 1-month T-bill:               |
| illustrative, point-in-time (27 Aug 2026). Verify live.            |
| [ Check: is this a loan? ]                    [ Continue ]         |
+--------------------------------------------------------------------+
```

Evidence C-CASH-1 (via M2 quiz) · content `M2` · EC-CS-002

### SCR-004 Learn › CSP arithmetic

```
+-- SCR-004 ------------------------------------ /learn/arithmetic --+
| Ticket (seed 8812):  SELL 1 QQQ 90 P @ 1.30                        |
|                                                                    |
|   Reserve     [  9,000.00 ]  ok   = 90 x 100 x 1                   |
|   Max profit  [    130.00 ]  ok   = 1.30 x 100 x 1                 |
|   Break-even  [     88.70 ]  ok   = 90 - 1.30                      |
|   Worst case  [  8,870.00 ]  ok   = reserve - max profit           |
|                                                                    |
| Payoff at expiry: S 100 +130 | S 90 +130 | S 88.70 0 | S 80 -870   |
| Tickets correct 2 / 3 (distinct seeds)                             |
|                                                                    |
| [ Next ticket ]        (Continue disabled while a field is blank)  |
+--------------------------------------------------------------------+
```

API `POST /calc/invariants` · evidence C-ARITH-1 · EC-IV-001…004, EC-MN-001 · US-1

### SCR-005 Learn › Wheel

```
+-- SCR-005 ----------------------------------------- /learn/wheel --+
| THE WHEEL                                                          |
|                                                                    |
|   cash-put --sell put--> short put --assigned--> shares-held       |
|      ^                                               |             |
|      |                                          sell call          |
|      +---- called away <---- short call <------------+             |
|                            (strike >= basis)                       |
|                                                                    |
| Basis = put strike - put premium (the actual fill)                 |
| One lot. Never add a second lot to catch up.                       |
| Early assignment can happen any day (American style).              |
| [ Check understanding ]                         [ Continue ]       |
+--------------------------------------------------------------------+
```

Content `M5` · EC-WH-007/008 · US-4

### SCR-006 Learn › Quizzes

```
+-- SCR-006 ------------------------------- /learn/quizzes/$module --+
| QUIZ M3 · CSP arithmetic          graded · hints off · item 4/10   |
|                                                                    |
| "Sell 1 QQQ 90 put at 1.30." What is the break-even?               |
|    ( ) 91.30     ( ) 90.00     (*) 88.70     ( ) 1.30              |
|                                                                    |
| [ Submit answer ]                                                  |
|                                                                    |
| Result 9/10 = 90 %  >= 80 %  PASSED                                |
| Fail: remediation card MC-02 must be opened before a retry         |
| Agent Drill is disabled on graded items                            |
+--------------------------------------------------------------------+
```

API `POST /quiz/:module/attempts` · evidence C-*-quiz · EC-LN-001/004 · US-1

### SCR-007 Game hub

```
+-- SCR-007 ------------------------------------------ /learn/game --+
| SERIOUS GAME HUB                 mastery 4/6 · paper wheel: no     |
|                                                                    |
|   vocabulary        ########## passed                              |
|   arithmetic        ########## passed                              |
|   risk              ######.... in progress                         |
|   cash_discipline   ########## passed                              |
|   strike_selection  ########## passed                              |
|   management        .......... locked                              |
|                                                                    |
| [Tutorial] [Scenario] [Crash] [Committee] [Paper lab: full wheel]  |
| Mentor and Live stay locked until 6/6 and the paper wheel.         |
+--------------------------------------------------------------------+
```

API `GET /mastery` · capability `mentor_selectable` · EC-LN-003 · US-2

### SCR-008 Game › Tutorial

```
+-- SCR-008 --------------------------------- /learn/game/tutorial --+
| TUTORIAL · mock IBKR Mobile ticket (not a real broker)             |
|                                                                    |
|   QQQ 650 P Dec-18    Bid 12.40  |  Ask 12.60                      |
|   Tap the price that SELLS the put:  [ 12.40 Bid ] [ 12.60 Ask ]   |
|                                                                    |
|   > You tapped Ask. That BUYS a put. A draft would be blocked:     |
|     WRONG_SIDE. Sellers use the Bid.                               |
|                                                                    |
|   Step 3/7: SELL · Qty 1 · LMT · DAY · Preview must say SELL       |
| [ Try again ]                                      (not graded)    |
+--------------------------------------------------------------------+
```

Mode `tutorial` · not graded · MC-01 · EC-DR-001

### SCR-009 Game › Scenario

```
+-- SCR-009 ----------------------------- /learn/game/scenario/$id --+
| SCENARIO · seed 20260828 · week 0 of 12 · graded                   |
| Spot 721.11 · Beginner 5-12 % · T-bill 3.78 % · 84 DTE             |
|                                                                    |
|  #  Strike  OTM     Bid  Reserve   MaxP     BE  Flags              |
|  A  650     9.9 %  9.70   65,000    970 640.30                     |
|  B  700     2.9 % 18.10   70,000  1,810 681.90  OUT OF BAND        |
|  C  560    22.3 %  1.05   56,000    105 558.95  BAND + HURDLE      |
|                                                                    |
| Pre-commit: "If -20 % in week 2, I will ____________________"      |
| [ Skip ]   [ Choose A ]   [ Choose B ]   [ Choose C ]              |
+--------------------------------------------------------------------+
```

Mode `scenario` / `paper_lab` (put leg) · evidence C-STRIKE-2 · EC-LN-001

### SCR-010 Game › Crash

```
+-- SCR-010 -------------------------------- /learn/game/crash/$id --+
| CRASH · gfc_2008 path · week 2 of 26 · graded                      |
|                                                                    |
| QQQ -21.4 % since the sale · spot 566.80 · your BE 640.30          |
| Short put marked to market: -7,450 (unrealised)                    |
| Your plan (week 0): "Hold; accept assignment; no second lot."      |
|                                                                    |
| What now?  ( ) Hold per plan  ( ) Buy back  ( ) Roll  ( ) Add lot  |
| [ Confirm action ]           (no timer; the path waits for you)    |
|                                                                    |
| Debrief: p05 of this path · plan followed? · what surprised you?   |
+--------------------------------------------------------------------+
```

Mode `crash` · evidence C-RISK-1 · no timers · EC-LN-005, EC-SM-004

### SCR-011 Game › Committee

```
+-- SCR-011 -------------------------------- /learn/game/committee --+
| MONTHLY COMMITTEE (practice) · seeded snapshot                     |
|                                                                    |
| 1 Numbers  650 P @ 9.70: 65,000 / 970 / 640.30 / 64,030            |
| 2 Stress   crash [attached gfc_2008]  MC [attached p05 -3.1 %]     |
| 3 Premortem "What makes this go wrong?" [__________________]       |
| 4 Plan     "If -20 % in week 2, I will" [___________________]      |
|                                                                    |
| [ Skip v ]        [ Wait ]        [ Prepare practice draft ]       |
|                                                                    |
| Rubric scores process only. P&L is shown afterwards, weight 0.     |
+--------------------------------------------------------------------+
```

Mode `committee` · evidence C-MGMT-1 · US-7, US-11

### SCR-012 Game › Post-assign

```
+-- SCR-012 ------------------------------ /learn/game/post-assign --+
| POST-ASSIGN (call leg) · paper lab · graded                        |
|                                                                    |
| You were assigned 100 QQQ at 650. Your put fill was 9.62.          |
| Basis = 650 - 9.62 = [ ______ ]                                    |
| Spot 598.20. Call candidates (60-120 DTE):                         |
|   620 C  bid 14.10  strike < basis: LOCKED LOSS if called          |
|   645 C  bid  7.30  strike >= basis                                |
|   680 C  bid  2.40  strike >= basis                                |
| [ Skip ] [ Choose 645 ] [ Choose 680 ] [ Choose 620 + justify ]    |
| Then: choose the lifecycle outcome at expiry                       |
+--------------------------------------------------------------------+
```

Mode `post_assign` / `paper_lab` (call leg) · evidence C-MGMT-2/3 · MC-06/07

## 4. Simulate

### SCR-020 Simulate › Payoff

```
+-- SCR-020 ------------------------------------- /simulate/payoff --+
| PAYOFF LAB          Envelope: Beginner (DEFAULT) · illustrative    |
| (P) Strike [650.00] Premium [9.80] Qty [1] Spot [721.11]           |
| Reserve 65,000.00 · Max profit 980.00 · BE 640.20 · Worst 64,020   |
|                                                                    |
|   P&L  +980 |               __________________  (S >= 650)         |
|           0 |------------/-----------------------                  |
|             |          /  640.20 break-even                        |
|    -64,020 |________/   (S = 0)                                    |
|              0       640 650               S at expiry             |
|                                                                    |
| [ Table ]  S 500 -14,020 | 600 -4,020 | 640.20 0 | 650+ +980       |
+--------------------------------------------------------------------+
```

API `POST /sim/payoff` · US-1 · EC-IV-001, EC-MN-003

### SCR-021 Simulate › Crash

```
+-- SCR-021 -------------------------------------- /simulate/crash --+
| CRASH HISTORY                    not a forecast · Beginner default |
| Scenario [ dotcom_2000 v ]  gfc_2008 · covid_2020 · custom (P1)    |
| Sizing (*) willingness 1 lot   ( ) fill_cash  DANGEROUS            |
|                                                                    |
| Ending wealth (start 100,000):                                     |
|   CSP 1 lot  ################....   82,400                         |
|   T-bill     ####################  104,100                         |
|   Buy QQQ    ######..............   31,700                         |
| Assigned: week 9 · premium kept 1,020 · max drawdown -35.2 %       |
|                                                                    |
| [ Attach to packet ]    model crash-lib-v1 · input sha256:9c…      |
+--------------------------------------------------------------------+
```

API `POST /sim/crash` (inline) · `PUT /memos/:id/stress/crash` · US-3 · EC-SM-005/006

### SCR-022 Simulate › Monte Carlo

```
+-- SCR-022 -------------------------------- /simulate/monte-carlo --+
| MONTE CARLO · csp-mc-bootstrap-q-v1     educational, not forecast  |
| Paths [10000] Quarters [20] Seed [20260828] OTM [10 %] Beginner    |
| Sizing: willingness · max_contracts 1          [ Run ] (~20 ms)    |
|                                                                    |
| CAGR  p05 -2.9 %   p50 6.1 %   p95 11.8 %   P(end<start) 14 %      |
| Median max drawdown -18.7 %          target_funded rate 91 %       |
| Fan of ending wealth by quarter           [ table alternative ]    |
|                                                                    |
| Meeting ~7-8 % is illustrative: not a guarantee, not a floor.      |
| Past paths are not the future. Annualising one quiet quarter is    |
| misleading.       [ Attach to packet ]  input sha256:3f1a…         |
+--------------------------------------------------------------------+
```

API `POST /sim/mc` (inline, worker thread) · US-3 · EC-SM-001…003

### SCR-023 Simulate › Backtest

```
+-- SCR-023 ----------------------------------- /simulate/backtest --+
| BACKTEST (rule replay) · proxy premiums (Black-Scholes)            |
| Window [2010-03-31] -> [2026-08-27]   Envelope [ Beginner v ]      |
| Wheel flag [on]   Early-assignment model: none (disclosed)         |
|                                                                    |
| [ Queue run ]   queued -> running 43 % -> done   job 0192…         |
| CAGR · vol · max DD · assignment freq · % quarters premium < rf    |
| Decision log: 2010Q2 sell 5 % OTM · 2011Q3 skip (below hurdle)     |
|                                                                    |
| Claim: UNCONFIRMED. Mentor long-run CAGR is not established.       |
| [ Attach to packet (optional) ]                                    |
+--------------------------------------------------------------------+
```

API `POST /sim/backtest` → 202 + `GET /jobs/:id` · claim `unconfirmed` · EC-SM-007/008

## 5. Decide (put phase)

### SCR-102 Decide › Inputs

```
+-- SCR-102 --------------------------------------- /decide/inputs --+
| INPUTS · what you see in IBKR, with its time    cite or refuse     |
| Account  as of [2026-09-24 09:40 HKT]                              |
|   USD settled [100,000.00]  HKD [0.00]  Options level [3 v]        |
| Market   QQQ spot [721.11]  as of [2026-09-23 15:58 ET]            |
|   Expiry      Strike  P/C   Bid     Ask     [+ row] [paste CSV]    |
|   2026-12-18  650     P     12.40   12.60                          |
|   2026-12-18  640     P     10.90   11.10                          |
| Rate  13-week T-bill [3.78] %  as of [2026-08-27]                  |
|       source [https://…treasurydirect.gov/…]  (https required)     |
| [ Save snapshot ]   crossed, future or unsourced rows rejected     |
+--------------------------------------------------------------------+
```

API `POST /inputs/account-snapshots|market-snapshots|rates` · US-9 · EC-MD-001…008, EC-CS-001…004

### SCR-030 Decide › Snapshot

```
+-- SCR-030 ------------------------------------- /decide/snapshot --+
| ACCOUNT SNAPSHOT · Paper · as of 09:40 HKT (21:40 ET, prev day)    |
|                                                                    |
| USD settled   100,000.00      HKD cash  0.00     FX loan: NO       |
| Reserved (open short puts) 0.00 · Leftover 100,000.00              |
| Options level 3 (put needs 3 · call needs 1)            OK         |
| Next lot reserve (650 P) 65,000 -> target_funded: yes              |
| Lots 0 / 1                                                         |
|                                                                    |
| [ Update on Inputs ]                       [ See candidates ]      |
| FX loan YES => red row + halt fx_loan + "How to convert"           |
+--------------------------------------------------------------------+
```

API `GET /inputs/account-snapshots/latest` · `R-FX`, `R-LEVEL`, `R-CASH` · EC-CS-001…004

### SCR-031 Decide › Candidates

```
+-- SCR-031 ----------------------------------- /decide/candidates --+
| PUT CANDIDATES · Beginner 5-12 % · 60-120 DTE · spot 721.11        |
| Quotes 15:58 ET (03:58 HKT) · T-bill 3.78 % (2026-08-27, src)      |
|                                                                    |
| #  Strike Exp   OTM   Bid x Ask    Reserve   MaxP     BE  Worst    |
| 1  650   Dec18  9.9%  12.40x12.60  65,000   1,240 637.60 63,760    |
| 2  640   Dec18 11.3%  10.90x11.10  64,000   1,090 629.10 62,910    |
|    score: #1 0.0352 · #2 0.0254 (excess over T-bill, spread-adj)   |
| -  690   Dec18  4.3%  19.50x19.80  rejected OTM_OUTSIDE_ENVELOPE   |
| -  600   Dec18 16.8%   5.10x5.30   rejected OTM_OUTSIDE_ENVELOPE   |
|                                                                    |
| [ Skip this month ]                 [ Build packet with #1 ]       |
+--------------------------------------------------------------------+
```

API `POST /memos` + `POST /memos/:id/candidates:score` · US-1, US-2, US-7 · EC-MD-001/002/004, EC-EN-001

### SCR-032 Decide › Put packet

```
+-- SCR-032 ------------------------------- /decide/packet/$memoId --+
| PUT PACKET · memo 0192… · building · Beginner · Paper              |
| SELL 1 QQQ 650 P Dec-18-2026 · limit 12.40 (bid) · 86 DTE (ET)     |
| Reserve 65,000.00 · Max profit 1,240.00 · BE 637.60 · Worst 63,760 |
| Premium leg 8.10 % ann. (comparison) | T-bill 3.78 % (if earned)   |
| Stress  crash [attached gfc_2008]   MC [missing: run on SCR-022]   |
| Plan    "If QQQ -20 % in week 2, I will" [____________________]    |
| Agent (optional): "Packet lacks MC; I cannot assess p05."          |
|                                                                    |
| [ Skip v ]          [ Wait ]          [ Prepare draft ] disabled   |
| Disabled because: PACKET_INCOMPLETE (mc)                           |
+--------------------------------------------------------------------+
```

API `GET /memos/:id`, `PUT /memos/:id/stress/:kind`, `POST /memos/:id/skip|decide`, `POST /drafts` · US-3, US-7, US-11 · EC-PK-001…006

### SCR-033 Decide › History

```
+-- SCR-033 -------------------------------------- /decide/history --+
| MEMO HISTORY                 filters: [all v] [2026 v] [skips]     |
|                                                                    |
| Date        Phase     Decision  Reason / candidate       Draft     |
| 2026-09-24  cash-put  skip      premium_below_tbill      -         |
| 2026-08-28  cash-put  sell      650 P Nov-20 @ 9.80      0192…     |
| 2026-07-30  cash-put  wait      "FOMC week"              -         |
|                                                                    |
| Skips are decisions. 1 of 3 memos this quarter was a skip.         |
| Empty: "No memos yet. Skip is a valid decision."                   |
+--------------------------------------------------------------------+
```

API `GET /memos?cursor=` · US-7 · EC-PK-005

## 6. Decide (share phase)

### SCR-034 Decide › Assignment

```
+-- SCR-034 -------------------------- /decide/assignment/$cycleId --+
| ASSIGNMENT & BASIS · cycle 0192… · Paper                           |
| Broker notice: put assigned · +100 QQQ at 650.00 [2026-12-18]      |
| Put legs this cycle: opened at 12.35 (fill) · no rolls             |
| Decision basis = 650.00 - 12.35 = 637.65 per share                 |
| (Your broker may show a different tax basis. This one drives       |
|  the call rule.)                                                   |
| Ledger: assignment_purchase -65,000.00                             |
| Phase -> shares-held · put screens lock (SCR-039)                  |
|                                                                    |
| [ Cancel ]                                [ Confirm assignment ]   |
+--------------------------------------------------------------------+
```

API `POST /cycles/:id/events {type:'assigned'}` · US-8 · EC-WH-001/002/009

### SCR-035 Decide › Willingness

```
+-- SCR-035 ---------------------------------- /decide/willingness --+
| WILLINGNESS · shares-held · 100 QQQ @ basis 637.65                 |
| Spot 598.20 (-6.2 % vs basis). A further -30 % = 418.74.           |
| Unrealised at 418.74: -21,891 (100 x (418.74 - 637.65))            |
|                                                                    |
| Are you willing to keep 100 QQQ through a further large            |
| drawdown, and to sell calls only at >= 637.65 unless you           |
| choose to lock a loss?                                             |
| Lots 1/1 · no second lot without cash + willingness + audit        |
|                                                                    |
| [ Decline -> halt ]                            [ I am willing ]    |
+--------------------------------------------------------------------+
```

API `POST /wheel/willingness` · halt `willingness_declined` · EC-WH-006

### SCR-036 Decide › Call candidates

```
+-- SCR-036 ------------------------------ /decide/call-candidates --+
| CALL CANDIDATES · basis 637.65 · spot 598.20 · 60-120 DTE          |
| Filter: strike >= basis (default) · quotes 15:57 ET                |
|                                                                    |
| #  Strike Exp    Bid x Ask    Credit  If called  Max profit        |
| 1  640   Mar19   9.10x9.40      910      +235      1,145           |
| 2  660   Mar19   5.20x5.40      520    +2,235      2,755           |
| -  620   Mar19  16.00x16.40   1,600    -1,765  LOCKED LOSS         |
|                                                                    |
| Next ex-dividend (you entered) 2027-03-22: after expiry, clear     |
| [ Skip ]                                  [ Build call packet ]    |
+--------------------------------------------------------------------+
```

API `POST /memos` (phase shares-held) + score · `R-BASIS`, `R-EXDIV`, `R-ITM` · EC-WH-004/008/010

### SCR-037 Decide › Call packet

```
+-- SCR-037 -------------------------- /decide/call-packet/$memoId --+
| CALL PACKET · memo 0193… · basis rule ON                           |
| SELL 1 QQQ 640 C Mar-19-2027 · limit 9.10 · 88 DTE · 100 sh        |
| Credit 910.00 · Max if called 1,145.00 · Worst (S->0) 62,855       |
| Basis 637.65 <= strike 640: OK       Crash: optional (attached)    |
| Plan (optional) "If QQQ +15 % before expiry, I will" [_______]     |
|                                                                    |
| [ Skip v ]          [ Wait ]          [ Prepare draft ]            |
|                                                                    |
| Strike < basis => Prepare disabled: LOCKED_LOSS_UNSIGNED           |
| -> "Accept a locked loss on SCR-045 (audited)"                     |
+--------------------------------------------------------------------+
```

API as SCR-032 (crash optional for calls) · US-7, US-8 · EC-WH-004

### SCR-038 Decide › Call ticket

```
+-- SCR-038 ------------------------- /decide/call-ticket/$draftId --+
| CALL TICKET · draft 0194… · open                                   |
|                                                                    |
| SELL 1 QQQ 640 C Mar-19-2027 LMT 9.10 DAY                          |
| Credit 910.00 · Shares covered 100                                 |
| If called away: +235 on shares -> total 1,145.00                   |
| Share break-even after credit: 628.55                              |
|                                                                    |
| Preview in IBKR must read: SELL · CALL · credit · 100 covered      |
| [ Open IB preview coach ]                                          |
+--------------------------------------------------------------------+
```

API `GET /drafts/:id` · US-4 · EC-DR-001/005

### SCR-039 Decide › Put lock

```
+-- SCR-039 ------------------------------------- /decide/put-lock --+
| PUTS ARE LOCKED WHILE YOU HOLD SHARES                              |
|                                                                    |
| Phase: shares-held (cycle 0192…) · 100 QQQ @ basis 637.65          |
| Why: one lot. A new put needs another 100-share reserve.           |
|                                                                    |
| What you can do:                                                   |
|   -> Manage a covered call        (SCR-036)                        |
|   -> Record a lifecycle outcome   (SCR-044)                        |
|   -> Learn: the wheel             (SCR-005)                        |
+--------------------------------------------------------------------+
```

Redirect target of guard `phase_cash_put=false` · EC-WH-005

## 7. Execute

### SCR-040 Execute › Put playbook

```
+-- SCR-040 ---------------------------- /execute/put-playbook/$id --+
| IBKR MOBILE · SELL PUT STEPS · draft 0194… · PAPER                 |
| Precheck [x] SIMULATED TRADING bar  [x] Level 3                    |
|          [x] USD settled >= 65,000  [x] no negative balance        |
| 1 Watchlists -> QQQ -> Quote Details                  [ done ]     |
| 2 Options -> expiry Dec-18-2026 (86 DTE)              [ done ]     |
| 3 Puts (right side) -> strike 650                     [      ]     |
| 4 Tap PUT BID (Bid = sell · Ask = buy)                [      ]     |
| 5 Ticket: SELL · Qty 1 · LMT 12.40 · DAY              [      ]     |
| 6 Preview must show SELL · PUT · credit · reserve     [      ]     |
| Numbers: 65,000 · 1,240 · 637.60 · 63,760                          |
| [ Open IB preview coach ]    (open IBKR Mobile yourself: OPEN-5)   |
+--------------------------------------------------------------------+
```

API `GET /drafts/:id`, `POST /drafts/:id/steps` · banner required · US-4 · EC-DR-003/004, halt `paper_bar_missing`

### SCR-041 Execute › Draft coach

```
+-- SCR-041 ----------------------------- /execute/draft-coach/$id --+
| DRAFT COACH · draft 0194… · status BLOCKED                         |
| You entered: BUY 1 QQQ 650 P LMT 12.40 DAY                         |
| Checklist (code decides):                                          |
|   x  R-SIDE  WRONG_SIDE: an opening put must be SELL [fix side]    |
|   ok R-LMT  R-TICK  R-CHAIN  R-STALE  R-PHASE  R-LOTS  R-OTM       |
|   ok R-DTE  R-CASH  R-FX  R-LEVEL  R-PACKET  R-HALT  R-MODE        |
|   ok R-ALLOW                                                       |
| Agent (explains; cannot change status):                            |
|   "Buying a put pays premium instead of collecting it. [M1]"       |
|                                                                    |
| [ Edit draft ]                           [ Continue ] disabled     |
+--------------------------------------------------------------------+
```

API `POST /drafts/:id/review` (rules + optional agent) · banner required · US-5 · EC-DR-001…007, EC-AG-001…004

### SCR-042 Execute › Human gate

```
+-- SCR-042 ------------------------------ /execute/human-gate/$id --+
| HUMAN GATE · draft 0194… · PAPER                                   |
| This app will NOT send the order. You submit it in IBKR.           |
| [ ] Preview showed SELL · PUT · QQQ · Dec-18 · 650 · LMT 12.40     |
| [ ] Preview credit ~1,240 and reserve 65,000 match                 |
| [ ] My -20 % plan is written (below)                               |
| [ ] The IBKR login matches the mode (PAPER bar visible)            |
| Plan: "Hold; accept assignment; calls >= basis; no 2nd lot."       |
|                                                                    |
| [ Discard draft ]          [ I submitted it in IBKR ]              |
| Live mode adds a disclosure re-ack (copy v1) before the button     |
+--------------------------------------------------------------------+
```

API `POST /drafts/:id/human-gate` · audit `draft_submitted_by_user` · banner required · US-5 · EC-DR-006, EC-CP-003

### SCR-103 Execute › Short-put life

```
+-- SCR-103 -------------------------- /execute/short-put-life/$id --+
| SHORT PUT · cycle 0192… · 650 P Dec-18-2026 · PAPER                |
| Record fill: price [ 12.35 ]  time [2026-09-24 22:41 HKT]          |
|   (limit was 12.40; fills can differ; basis uses the FILL)         |
| Spot 566.80 < BE 637.65 -> your plan: "Hold; accept assign…"       |
|                                                                    |
| Outcome:                                                           |
|   ( ) Expired worthless     ( ) Bought back (BUY-to-close draft)   |
|   ( ) Rolled (close + open, inside envelope)                       |
|   ( ) Assigned (any day: American style) -> SCR-034                |
|   ( ) Never filled -> discard the draft                            |
| [ Record outcome ]            illegal moves -> 409, explained      |
+--------------------------------------------------------------------+
```

API `POST /drafts/:id/fill`, `POST /cycles/:id/events` · US-10, US-11 · EC-WH-001…003/007, EC-DR-007

### SCR-043 Execute › Call playbook

```
+-- SCR-043 --------------------------- /execute/call-playbook/$id --+
| IBKR MOBILE · SELL CALL STEPS · draft 0195… · PAPER                |
| Precheck [x] SIMULATED TRADING  [x] Level >= 1  [x] 100 QQQ        |
| 1 Portfolio -> QQQ -> Options (or Wizard -> Protect a              |
|   Position -> Covered Call CREDIT)                   [      ]      |
| 2 Expiry Mar-19-2027 (88 DTE) · strike 640 (>= basis) [      ]     |
| 3 Tap CALL BID (Bid = sell)                           [      ]     |
| 4 Ticket: SELL · Qty 1 · LMT 9.10 · DAY               [      ]     |
| 5 Preview must show SELL · CALL · credit · 100 covered[      ]     |
|                                                                    |
| [ Open IB preview coach ]                                          |
+--------------------------------------------------------------------+
```

Twin of SCR-040 · banner required · US-4 · EC-DR-005, EC-WH-004

### SCR-044 Execute › Short-call life

```
+-- SCR-044 ------------------------- /execute/short-call-life/$id --+
| SHORT CALL · cycle 0192… · 640 C Mar-19-2027 · fill 9.10           |
| Shares 100 @ basis 637.65 · spot 652.40 · ex-div after expiry      |
|                                                                    |
| Outcome:                                                           |
|   ( ) Expired worthless -> keep shares -> new call (SCR-036)       |
|   ( ) Bought back early -> shares-held                             |
|   ( ) Rolled (close + open later expiry)                           |
|   ( ) Called away at 640 -> +64,000 · cycle closed · cash-put      |
|   ( ) Shares sold manually (after the call is closed)              |
| [ Record outcome ]                        lots 1 -> 0 on close     |
+--------------------------------------------------------------------+
```

API `POST /cycles/:id/events` · US-8 · EC-WH-002/007/008

### SCR-045 Execute › Halt / veto

```
+-- SCR-045 ---------------------------------------- /execute/halt --+
| HALT / VETO                             no Prepare until cleared   |
| Account halt: fx_loan (raised 2026-09-24 09:41 HKT)                |
|   Evidence: snapshot 0192… USD settled -1,250.00                   |
|   Clears when: a new snapshot shows no negative balance            |
|   How: IBKR -> convert currency -> then Inputs (SCR-102)           |
|   [ Re-check now ]                                                 |
| Draft veto: LOCKED_LOSS_UNSIGNED on 620 C (basis 637.65)           |
|   Type I ACCEPT A LOCKED LOSS [_____________] reason [_______]     |
|   [ Accept locked loss (audited) ]                                 |
+--------------------------------------------------------------------+
```

API `GET /wheel/state`, `DELETE /wheel/halt`, `POST /wheel/locked-loss-accept` · EC-WH-003/004/006, EC-CS-002

### SCR-046 Execute › Quarterly ledger

```
+-- SCR-046 ---------------------------- /execute/quarterly-ledger --+
| QUARTERLY LEDGER · educational · not tax advice  [quarter v]       |
|                                                                    |
| Quarter  Kind                 Cycle   Amount USD  Date (ET)        |
| 2026-Q3  put_premium          0192…     +1,235.00 2026-09-24       |
| 2026-Q4  assignment_purchase  0192…    -65,000.00 2026-12-18       |
| 2026-Q4  call_premium         0192…       +910.00 2026-12-21       |
| 2027-Q1  called_away_sale     0192…    +64,000.00 2027-03-19       |
|                                                                    |
| Premium received 2,145.00 · no blended yield shown                 |
| [ Export CSV ]        group by HK year of assessment: SCR-051      |
+--------------------------------------------------------------------+
```

API `GET /ledger?group=quarter` · US-6 · EC-LG-001/002

## 8. Journal

### SCR-050 Journal › Audit

```
+-- SCR-050 --------------------------------------- /journal/audit --+
| AUDIT LOG · append-only · chain OK (seq 1-212)     [ Verify ]      |
|                                                                    |
| Seq  Time (HKT)        Actor   Action                  Screen      |
| 212  2026-09-24 22:45  user    fill_recorded           SCR-103     |
| 211  2026-09-24 22:30  user    draft_submitted_by_user SCR-042     |
| 210  2026-09-24 22:12  system  draft_blocked           SCR-041     |
| 209  2026-09-24 22:10  user    draft_preview_created   SCR-032     |
|                                                                    |
| Filter [action v] [date v]     row -> payload JSON + hashes        |
| Broken chain => red banner "Audit chain broken at seq N"           |
+--------------------------------------------------------------------+
```

API `GET /audit?cursor=`, `GET /audit/verify` · EC-DB-005/006, EC-SEC-007

### SCR-051 Journal › HK tax

```
+-- SCR-051 -------------------------------------- /journal/tax-hk --+
| HK TAX JOURNAL · EDUCATIONAL · NOT TAX ADVICE                      |
| Year of assessment [2026/27 v]  (1 Apr 2026 - 31 Mar 2027)         |
| Rows 4 · premium credits 2,145.00 · purchases -65,000.00 USD       |
| Per-row note [____]   badges-of-trade flag [ ]                     |
|                                                                    |
| Copy v1-draft (adviser sign-off pending, OPEN-3) from doc 12       |
|                                                                    |
| [ Export CSV ]   first row carries the disclaimer · audited        |
| No filing, no tax computation, no "we"                             |
+--------------------------------------------------------------------+
```

API `GET /ledger?group=hk_yoa`, `GET /journal/tax/hk.csv`, `PUT /ledger/:id/annotation` · US-6 · EC-LG-003…005, EC-CP-004

### SCR-052 Journal › Lessons

```
+-- SCR-052 ------------------------------------- /journal/lessons --+
| LESSONS LEARNED   (no scores, no P&L ranking)                      |
|                                                                    |
| * MC-05 twice: picked a below-hurdle strike                        |
|     -> card "The safe-strike trap"                                 |
| * Committee: plan written and followed at week 2 (good process)    |
| * 2026-09-24 real memo: skipped below hurdle (correct process)     |
|                                                                    |
| [ Open card ]   [ Drill me with the agent (ungraded) ]             |
| Empty: "Complete a paper cycle to see lessons."                    |
+--------------------------------------------------------------------+
```

API `GET /lessons` (projection of game + memos) · content remediation cards

## 9. Agent and Me

### SCR-060 Agent

```
+-- SCR-060 ----------------------------------------------- /agent --+
| AGENT · mode [Ask|Ticket|Packet|Drill] · qwen3.5:9b-mlx (local)    |
|                                                                    |
| You: Should I sell the 650 put?                                    |
| Agent: I can't tell you what to trade. For 650 P the numbers       |
|   are reserve 65,000, max 1,240, BE 637.60 [calc_invariants].      |
|   Your packet still lacks MC stress [get_memo].                    |
| Tools used: calc_invariants · get_memo     (no submit tool)        |
|                                                                    |
| [ Ask a question...                                ] [ Send ]      |
| Offline: "Agent offline. All safety checks still run."             |
+--------------------------------------------------------------------+
```

API `POST /agent/chat` (SSE), `GET /agent/status` · US-5, US-12 · EC-AG-001…012

### SCR-070 Me › Settings

```
+-- SCR-070 ----------------------------------------- /me/settings --+
| SETTINGS                                                           |
|                                                                    |
| Display name [Raphael]  Language [English v]  Theme [system v]     |
| Jurisdiction [HK]   (changing it asks for disclosures again)       |
| Show ET next to HKT for market times  [x]                          |
| Reduce motion [ ]   Larger numbers [ ]                             |
| Sessions: this device (active)   [ Sign out everywhere ]           |
|                                                                    |
| [ Save ]                                                           |
+--------------------------------------------------------------------+
```

API `PATCH /me`, `POST /auth/sign-out?all=1` · EC-SEC-005

### SCR-071 Me › Envelope

```
+-- SCR-071 ----------------------------------------- /me/envelope --+
| ENVELOPE                                                           |
| (*) Beginner 5-12 % OTM · 60-120 DTE · DEFAULT                     |
| ( ) Mentor (Cyrille) 16-30 % · ~3 months · LOCKED (mastery 4/6)    |
|     [ Go to game hub ]      [ Override (not recommended) ]         |
|                                                                    |
| Override: 1 read "Why mastery first"  2 type OVERRIDE              |
| -> audited; the chrome shows "Mentor (override)"                   |
| Honest note: Mentor = lower premium and lower assignment           |
| frequency, not "~7-8 %".  History: Beginner since 2026-09-23       |
+--------------------------------------------------------------------+
```

API `PATCH /me/envelope` · audit `envelope_changed` / `envelope_override_before_mastery` · US-2 · EC-EN-002/003

### SCR-072 Me › Mode

```
+-- SCR-072 --------------------------------------------- /me/mode --+
| PAPER / LIVE MODE                                                  |
| (*) Paper (DEFAULT)      ( ) Live (disabled)                       |
|                                                                    |
| Live needs: [x] disclosures acked (v1)   [ ] mastery 6/6           |
|             [ ] paper wheel completed                              |
| Live adds a disclosure re-ack at the human gate and a red chip.    |
| Live never means "the app sends orders". It never does.            |
|                                                                    |
| [ Switch to Live ]   disabled: mastery incomplete                  |
+--------------------------------------------------------------------+
```

API `PATCH /me/mode` · capability `live_eligible` · banner required when Live · US-4, US-5 · EC-CP-003

### SCR-073 Me › Compliance

```
+-- SCR-073 --------------------------------------- /me/compliance --+
| COMPLIANCE & DISCLOSURES                                           |
| Banner: always on (not dismissible on Execute or Agent)            |
| Jurisdiction gate: HK · voice: personal book (never "we")          |
| Acknowledged: education-not-advice v1 · options-risk v1            |
|               no-auto-send v1 · hk-tax-education v1-draft          |
| Advice-seeking questions to the agent are logged for review (3)    |
|                                                                    |
| [ View disclosure log ]            [ Re-read disclosures ]         |
+--------------------------------------------------------------------+
```

API `GET /me/disclosures` · US-6 · EC-CP-001/005

## 10. Cross-screen invariants (asserted by e2e for every registry entry)

| Invariant | Screens | Test |
|-----------|---------|------|
| Five numbers render before any score / rank in DOM order | 004, 020, 031, 032, 036–038, 040, 041 | `[US-1][EC-UX-001]` |
| Skip precedes Prepare in tab order and has the same size | 031, 032, 036, 037, 009, 011, 012 | `[US-7][EC-UX-002]` |
| No CTA label starts with «Sell» | all | copy lint + `[US-4][EC-CP-002]` |
| Banner present; not dismissible where `required` | all | `[US-5][EC-CP-001]` |
| Every `as of` shows HKT and ET | 030, 031, 032, 036, 102 | `[US-9][EC-TM-004]` |
| Empty chain shows the refusal text, never a number | 031, 036, 040 | `[US-1][EC-MD-001]` |
| Axe: no serious or critical violations | all | `[EC-UX-003]` |

---

## Cross-references

[04 Flows](04-ux-ia-flows.md) · [06 Components](06-ui-design-system.md#5-component-inventory) · [07 API](07-architecture.md#6-api-surface) ·
[08 Routes](08-frontend-architecture.md#3-route-tree) · [12 Copy](12-compliance-copy.md) · [16 Traceability](16-traceability.md)
