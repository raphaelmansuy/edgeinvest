// LLM adapters (docs/11 §5): Ollama for real use, FakeLlm for deterministic e2e. Both satisfy the Llm port (LSP).
import type { ChatChunk, ChatMessage, Llm, ToolCall, ToolSpec } from "../ports";
import { fakeLlm } from "./fake-llm";

export function ollamaLlm(baseUrl: string, model: string, embedModel: string): Llm {
  let cached: { at: number; value: { available: boolean; model: string; embedModel: string } } | null = null;
  return {
    async *chat(req: { messages: ChatMessage[]; tools?: ToolSpec[]; temperature?: number }, signal: AbortSignal): AsyncIterable<ChatChunk> {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST", signal, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: req.messages, tools: req.tools, stream: true, think: false,
          options: { temperature: req.temperature ?? 0.2, num_ctx: 8192 } }),
      });
      if (!res.ok || !res.body) throw new Error(`OLLAMA_HTTP_${res.status}`);
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        let nl = buf.indexOf("\n");
        while (nl >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          nl = buf.indexOf("\n");
          if (!line) continue;
          const j = JSON.parse(line) as { message?: { content?: string; tool_calls?: ToolCall[] }; done?: boolean };
          if (j.message?.tool_calls?.length) yield { type: "tool_calls", calls: j.message.tool_calls };
          if (j.message?.content) yield { type: "token", text: j.message.content };
          if (j.done) yield { type: "done" };
        }
      }
    },
    async embed(texts: string[]) {
      const res = await fetch(`${baseUrl}/api/embed`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: embedModel, input: texts }),
      });
      if (!res.ok) throw new Error(`OLLAMA_EMBED_${res.status}`);
      return ((await res.json()) as { embeddings: number[][] }).embeddings;
    },
    async status() {
      if (cached && Date.now() - cached.at < 15_000) return cached.value;
      const value = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(1500) })
        .then(async (r) => {
          const tags = ((await r.json()) as { models: { name: string }[] }).models.map((m) => m.name);
          return { available: tags.some((t) => t === model || t.startsWith(`${model}`)), model, embedModel };
        })
        .catch(() => ({ available: false, model, embedModel }));
      cached = { at: Date.now(), value };
      return value;
    },
  };
}

export function makeLlm(env: NodeJS.ProcessEnv): Llm {
  const model = env.AGENT_MODEL ?? "qwen3.5:9b-mlx";
  const embed = env.EMBED_MODEL ?? "embeddinggemma";
  if (env.AGENT_PROVIDER === "fake") return fakeLlm(model, embed, env.FAKE_LLM_OFFLINE === "1");
  if (env.AGENT_PROVIDER === "off") return { ...fakeLlm(model, embed, true) };
  return ollamaLlm(env.OLLAMA_BASE_URL ?? "http://localhost:11434", model, embed);
}
