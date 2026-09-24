import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyArt,
  EmptyState,
  MasteryMeter,
  MoneyText,
  Stat,
  WheelDiagram,
  wheelNodeOf,
} from "@edge/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Screen, Stamp, StatusBadge } from "../../components/kit";
import { masteryQuery, memosQuery, wheelQuery } from "../../lib/queries";
import { useCaps } from "../../lib/screen";

export function HomeScreen() {
  const caps = useCaps();
  const wheel = useSuspenseQuery(wheelQuery()).data;
  const mastery = useSuspenseQuery(masteryQuery()).data;
  const memos = useSuspenseQuery(memosQuery()).data;
  const open = wheel.cycles[0];
  const leg = open?.open_leg;
  const node = wheelNodeOf(caps.phase, Boolean(leg && leg.put_call === "P"), Boolean(leg && leg.put_call === "C"));
  const next = nextStep(caps, wheel, memos.items[0]);

  return (
    <Screen
      scr="SCR-000"
      title={caps.user?.display_name ? `Hello, ${caps.user.display_name}` : "Your wheel"}
      lead="Learn, then simulate, then write the memo. A draft exists only after the packet is complete, and you still place every order yourself."
    >
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <h2 className="font-display text-xl text-ink sm:text-2xl">{next.title}</h2>
            <p className="mt-1 text-sm text-muted">{next.why}</p>
          </div>
          <Link to={next.href as "/"}>
            <Button variant="primary" size="lg">
              {next.cta}
            </Button>
          </Link>
        </div>

        <div className="strike-rail">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Settled USD" size="md">
              <MoneyText value={caps.settled_usd} />
            </Stat>
            <Stat label="Reserved" size="md">
              <MoneyText value={caps.reserved_usd} />
            </Stat>
            <Stat label="Leftover" size="md">
              <MoneyText value={caps.leftover_usd} />
            </Stat>
            <Stat label="Lots" size="md">
              <span className="num">
                {caps.lots_open}/{caps.lots_max}
              </span>
            </Stat>
          </div>
          <span className="strike-rail-label">cash on the blotter</span>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr_1fr]">
        <Card>
          <CardBody className="flex flex-col items-center gap-3 py-6">
            <WheelDiagram active={node} size={200} />
            <p className="text-sm font-medium text-ink">{phaseLine(caps.phase, leg?.put_call)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Mastery" />
          <CardBody className="flex flex-col gap-3">
            <p className="text-xs text-muted">Mentor unlocks when every meter is passed.</p>
            {mastery.competencies.map((c) => (
              <MasteryMeter key={c.id} label={labelOf(c.id)} status={c.status} progress={c.progress} />
            ))}
            {mastery.all_pass && <Badge tone="ok">Mastery complete</Badge>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title="Recent memos"
            actions={
              <Link to="/decide/history" className="text-sm font-medium text-accent hover:underline">
                History
              </Link>
            }
          />
          <CardBody>
            {memos.items.length === 0 ? (
              <EmptyState
                art={<EmptyArt kind="memo" />}
                title="No memo yet"
                teach="A memo is the written decision: sell, skip or wait. Capture inputs, then score a chain."
                action={
                  <Link to="/decide/inputs">
                    <Button variant="primary" size="sm">
                      Capture inputs
                    </Button>
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-hair">
                {memos.items.slice(0, 5).map((m) => (
                  <li key={m.memo_id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link
                        to={m.phase === "shares-held" ? "/decide/call-packet/$memoId" : "/decide/packet/$memoId"}
                        params={{ memoId: m.memo_id }}
                        search={{ candidate: undefined }}
                        className="text-sm font-medium text-ink hover:text-accent"
                      >
                        {m.phase === "shares-held" ? "Covered call" : "Cash-secured put"}
                      </Link>
                      <p className="text-xs text-muted">
                        {m.decision_date}
                        {m.top ? ` – ${m.top.put_call} ${m.top.strike}` : ""}
                        {" – "}
                        <Stamp at={m.created_at} />
                      </p>
                    </div>
                    <StatusBadge status={m.decision ?? m.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </Screen>
  );
}

function phaseLine(phase: string, putCall?: "P" | "C") {
  if (putCall === "C") return "Short call is open";
  if (putCall === "P") return "Short put is open";
  if (phase === "shares-held") return "Shares held, no call yet";
  return "Cash-put phase";
}

function labelOf(id: string) {
  return id.replaceAll("_", " ");
}

function nextStep(
  caps: { phase: string; halted: boolean },
  wheel: { willingness_confirmed_at: string | null; cycles: { cycle_id: string; open_leg: { put_call: "P" | "C" } | null }[] },
  memo?: { memo_id: string; status: string; phase: string; draft: { draft_id: string; status: string; put_call: "P" | "C" } | null },
) {
  if (caps.halted)
    return { title: "A halt is active", why: "Resolve the halt before any new draft.", href: "/execute/halt", cta: "Open halt" };
  const draft = memo?.draft;
  if (draft && (draft.status === "open" || draft.status === "blocked")) {
    const play = draft.put_call === "C" ? `/execute/call-playbook/${draft.draft_id}` : `/execute/put-playbook/${draft.draft_id}`;
    const href = draft.status === "blocked" ? `/execute/draft-coach/${draft.draft_id}` : play;
    return {
      title: draft.status === "blocked" ? "A draft is blocked" : "Finish the playbook",
      why: "The draft waits on you. EdgeInvest never sends the order.",
      href,
      cta: "Open draft",
    };
  }
  const cycle = wheel.cycles[0];
  if (cycle?.open_leg?.put_call === "P")
    return {
      title: "Your short put is live",
      why: "Record expiry, assignment or a buyback when it happens in IBKR.",
      href: `/execute/short-put-life/${cycle.cycle_id}`,
      cta: "Open the cycle",
    };
  if (cycle?.open_leg?.put_call === "C")
    return {
      title: "Your short call is live",
      why: "Record expiry, a buyback or being called away.",
      href: `/execute/short-call-life/${cycle.cycle_id}`,
      cta: "Open the cycle",
    };
  if (caps.phase === "shares-held" && !wheel.willingness_confirmed_at)
    return {
      title: "Would you keep these shares?",
      why: "Willingness comes before any covered call.",
      href: "/decide/willingness",
      cta: "Answer",
    };
  if (caps.phase === "shares-held")
    return {
      title: "Score a covered call",
      why: "Strike at or above your decision basis.",
      href: "/decide/call-candidates",
      cta: "Call candidates",
    };
  if (memo?.status === "building") {
    const href = memo.phase === "shares-held" ? `/decide/call-packet/${memo.memo_id}` : `/decide/packet/${memo.memo_id}`;
    return {
      title: "A memo is still building",
      why: "Attach crash and Monte Carlo, write the plan, then decide.",
      href,
      cta: "Open packet",
    };
  }
  return {
    title: "Start this month's memo",
    why: "Capture the account, the chain and a cited rate, then score strikes inside the envelope.",
    href: "/decide/inputs",
    cta: "Capture inputs",
  };
}
