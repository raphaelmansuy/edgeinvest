# 00 · Brief

> Visual redesign only. Behaviour, routes, copy, and gates stay in [`docs/`](../../docs/).
> Skill: [`.cursor/skills/frontend-design/`](../../.cursor/skills/frontend-design/SKILL.md).
> Sibling: [01-audit](01-audit.md) · [02-direction](02-direction.md) · [03-wireframes](03-wireframes.md) · [04-build](04-build.md).

---

## Subject

One cash-secured put on QQQ. The user may have to buy 100 shares at the strike. That obligation is the product.

## Audience

A careful person at the IBKR Mobile preview. Competent elsewhere; suddenly careful with numbers. They need the five numbers before any score, Skip as heavy as Prepare, and a clear next action when something is blocked ([docs/04](../../docs/04-ux-ia-flows.md)).

## Job of the interface

See the obligation before any draft exists. Write a decision memo. Place the order yourself. EdgeInvest never sends.

## Inherited rules this pass will not break

From [docs/06](../../docs/06-ui-design-system.md) and [docs/04](../../docs/04-ux-ia-flows.md):

| Rule | Why it stays |
|------|--------------|
| Numbers are the hero; tabular figures, units visible | Misreading a strike costs real money |
| One accent hue; red only for loss / live / blocked; amber for stale | Casino palettes hurry the user |
| Skip and Prepare share size and weight | No dark pattern |
| Text beats colour for every state | Colour-blind safety |
| Sticky compliance banner; not dismissible on Execute | Registry + e2e |
| Server decides, UI reflects (`capabilities`) | No client-side gate invention |
| Motion: none on numbers; `prefers-reduced-motion` respected | Calm instrument |
| 46 SCR ids, routes, CTA verbs from [docs/05](../../docs/05-screens-wireframes.md) | Traceability |

## What this pass changes

How the desk looks: palette, type, the memorable device (the strike rail), and the first-screen arrangement on sign-in and home. Shared kit only — every screen inherits.

## Out of scope

- New routes or screens
- Copy strings in `@edge/copy`
- Domain rules, envelopes, mastery
- Playwright / screenshot capture (separate epic)
