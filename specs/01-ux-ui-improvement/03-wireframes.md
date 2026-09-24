# 03 · Wireframes

> Structure and order only. SCR ids and CTA verbs match [docs/05](../../docs/05-screens-wireframes.md).
> Direction: [02-direction](02-direction.md). Build order: [04-build](04-build.md).

All frames are **left aligned**. Numbers before scores. Skip before Prepare on the packet.

---

## SCR-100 · Sign in (desktop)

```
+----------------------------------+--------------------------------+
| EdgeInvest  ----                 | Sign in                        |
|                                  | Learn, simulate, decide…       |
|                                  |                                |
|  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  | Email                          |
|  |                              | | [                          ]  |
|  |   (path of QQQ)              | |                                |
|  |                              | | Password                      |
|  ~~~~~~~~ strike rail ~~~~~~~~~  | | [                          ]  |
|  you may have to buy here        |                                |
|                                  | [ Sign in                    ] |
| Premium and discipline,          |                                |
| not a lottery ticket.            | Local · Practice accounts      |
|                                  | Password  paper-wheel-2026     |
| Learn the cash-secured put…      | [ Continue as Pat            ] |
|                                  | New / Lee / Dana / …           |
| No broker. No submit. Ever.      |                                |
|                                  | edu.sticky (footer)            |
+----------------------------------+--------------------------------+
```

Notes:
- Headline is one colour (ink). No accented fragment.
- Rail is the hero; HeroArt's obligation line is the rail, not a dashed footnote.
- Practice accounts stay; visually secondary (hairline panel).

## SCR-100 · Sign in (phone)

```
+---------------------------+
| EdgeInvest ----           |
| Sign in                   |
| Email / Password          |
| [ Sign in ]               |
| Practice accounts         |
| [ Continue as Pat ]       |
| …scroll…                  |
| edu.sticky                |
+---------------------------+
```

---

## Shell (authenticated)

```
+------------------------------------------------------------------+
| EdgeInvest ----   Learn  Simulate  Decide  Execute  Journal  …   |
|                   [paper]  theme  Tutor  account                 |
+------------------------------------------------------------------+
| cash-put   Lots 0/1   Reserved 0.00  Leftover 100,000.00   Env…  |
+------------------------------------------------------------------+
|                                                                  |
|  (main)                                                          |
|                                                                  |
+------------------------------------------------------------------+
| edu.sticky                                            copy v1    |
+------------------------------------------------------------------+
```

Notes:
- Solid blotter header (no blur).
- Chrome row is one ruled strip.
- Halt action: verb only, no trailing arrow.
- Mode chip: sentence case "Paper" / "Live · real money" (Live keeps loss colour).

---

## SCR-000 · Home

```
+------------------------------------------------------------------+
| Hello, Pat                                                       |
| Learn, then simulate, then write the memo…                       |
|                                                                  |
| A memo is still building.                        [ Open packet ] |
| Attach crash and Monte Carlo, write the plan, then decide.       |
| ---------------------------------------------------------------- |
| settled          reserved         leftover           lots        |
| 100,000.00       0.00             100,000.00         0/1         |
|                                                                  |
| +------------+  +----------------------+  +-------------------+  |
| |  (wheel)   |  | Mastery              |  | Recent memos      |  |
| | cash-put   |  | vocabulary  passed   |  | Cash-secured put  |  |
| +------------+  | arithmetic  locked   |  |   2026-09-23      |  |
|                 +----------------------+  +-------------------+  |
+------------------------------------------------------------------+
```

Notes:
- No "Home" / "Next" uppercase eyebrows.
- Next action is a sentence + one button, then a ruled stat row (the rail language).
- Memo meta: date on its own line or en-dash, not middle-dot soup.

---

## SCR-032 · Put packet (ticket block)

```
+------------------------------------------------------------------+
| Put packet                                         SCR-032       |
| SELL 1 QQQ 650 P · Dec-18-2026                                   |
|                                                                  |
| ---------------------------------------------------------------- |
| Reserve              Max profit           Break-even             |
| 65,000.00            1,240.00             637.60                 |
| you may have to buy here                                         |
| Worst case (QQQ → 0)  …                                          |
|                                                                  |
| [ Skip this month ]  [ Wait ]  [ Prepare draft ]                 |
+------------------------------------------------------------------+
```

Notes:
- Three numbers sit **on** the strike rail.
- Skip / Wait / Prepare equal size (unchanged).
- Worst-case line stays under the rail (loss tone).
