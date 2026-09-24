// Deterministic scripted LLM for e2e (docs/14 §5). Rules map a user message to tool calls + a reply.
// It behaves like a well-mannered model so that guards, citations and SSE plumbing are exercised end to end.
import type { ChatChunk, ChatMessage, Llm, ToolSpec } from "../ports";

const hashVec = (text: string) => {
  const v = new Array(768).fill(0);
  for (const w of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    let h = 2166136261;
    for (const ch of w) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    v[Math.abs(h) % 768] += 1;
  }
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
};

function* words(s: string): Generator<ChatChunk> {
  for (const part of s.match(/\S+\s*/g) ?? []) yield { type: "token", text: part };
}

export function fakeLlm(model: string, embedModel: string, offline = false): Llm {
  return {
    async *chat(req: { messages: ChatMessage[]; tools?: ToolSpec[] }): AsyncIterable<ChatChunk> {
      if (offline) throw new Error("AGENT_OFFLINE");
      const last = req.messages.at(-1)!;
      const user = [...req.messages].reverse().find((m) => m.role === "user")?.content ?? "";
      const q = user.toLowerCase();
      if (last.role === "user") {
        const invariants = /(\d{2,4}(?:\.\d+)?)\s*p(?:ut)?\b.*?@\s*(\d+(?:\.\d+)?)/i.exec(user);
        if (invariants) {
          yield { type: "tool_calls", calls: [{ function: { name: "calc_invariants",
            arguments: { put_call: "P", strike: invariants[1], premium: invariants[2], qty: 1 } } }] };
          yield { type: "done" };
          return;
        }
        if (/\b(bid|ask|spread|assignment|break-?even|wheel|reserve|envelope|t-?bill|hurdle)\b/.test(q)) {
          yield { type: "tool_calls", calls: [{ function: { name: "search_curriculum", arguments: { query: user.slice(0, 200) } } }] };
          yield { type: "done" };
          return;
        }
        if (/submit|place the order|send (the )?order/.test(q)) {
          yield* words("I can't do that. EdgeInvest never sends orders. You place the order yourself in IBKR, after checking the live preview.");
          yield { type: "done" };
          return;
        }
        if (/what should i (sell|buy)|which strike should|should i sell|life savings|all my savings/.test(q)) {
          yield* words("You should sell the 650 put, it is guaranteed income.");
          yield { type: "done" };
          return;
        }
        yield* words("I explain the numbers and the rules on this screen. Ask me about reserve, break-even, assignment, or the T-bill hurdle. [source: M1#seven-words]");
        yield { type: "done" };
        return;
      }
      // After tool results: summarise them, quoting the numbers exactly and citing the source.
      const tool = last.content;
      try {
        const j = JSON.parse(tool) as Record<string, unknown>;
        if ("reserve" in j) {
          yield* words(`For one contract the reserve is USD ${j.reserve}, the max profit is USD ${j.max_profit} before fees, break-even is ${j.break_even} and the worst case (QQQ → 0) is USD ${j.worst_case}. [source: calc_invariants]`);
        } else if (Array.isArray(j.chunks) && j.chunks.length) {
          const c = j.chunks[0] as { slug: string; anchor: string; text: string };
          yield* words(`${c.text.split(/(?<=\.)\s/).slice(0, 2).join(" ")} [source: ${c.slug}#${c.anchor}]`);
        } else {
          yield* words("I could not find that in the curriculum, so I will not guess.");
        }
      } catch {
        yield* words("I could not read the tool result, so I will not guess.");
      }
      yield { type: "done" };
    },
    async embed(texts: string[]) {
      if (offline) throw new Error("AGENT_OFFLINE");
      return texts.map(hashVec);
    },
    async status() {
      return { available: !offline, model: `fake:${model}`, embedModel };
    },
  };
}
