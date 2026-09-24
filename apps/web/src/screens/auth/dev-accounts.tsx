import { Badge, Button, IconCheck } from "@edge/ui";
import { useEffect, useState } from "react";

type Account = { email: string; name: string; blurb: string; password: string; recommended: boolean };

/** Practice accounts. Renders nothing unless this is a Vite dev server and the API was started with `make dev`. */
export function DevAccounts({ busy, onUse }: { busy: boolean; onUse: (email: string, password: string) => void }) {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const ac = new AbortController();
    void fetch("/api/v1/auth/dev-accounts", { signal: ac.signal })
      .then(async (r) => (r.ok ? (r.json() as Promise<{ accounts: Account[] }>) : null))
      .then((body) => {
        if (body?.accounts?.length) setAccounts(body.accounts);
      })
      .catch(() => undefined);
    return () => ac.abort();
  }, []);

  if (!import.meta.env.DEV || !accounts?.length) return null;

  const first = accounts[0];
  const shared = first && accounts.every((a) => a.password === first.password) ? first.password : null;
  const recommended = accounts.find((a) => a.recommended) ?? first;
  const rest = accounts.filter((a) => a !== recommended);
  if (!recommended) return null;

  async function copy(password: string) {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section
      className="mt-8 rounded-card border border-hair bg-raised p-4 shadow-card"
      data-testid="dev-accounts"
      aria-label="Practice accounts"
    >
      <div>
        <Badge tone="accent">Local</Badge>
        <h2 className="mt-2 text-sm font-semibold text-ink">Practice accounts</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">
          One click signs you in. Shown only while this machine is running <span className="font-medium text-ink">make dev</span>.
        </p>
      </div>

      {shared && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-control border border-hair bg-surface px-3 py-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted">Password</p>
            <p className="mono truncate text-sm text-ink" data-testid="dev-password">
              {shared}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => void copy(shared)}
            aria-label={copied ? "Password copied" : "Copy password"}
          >
            {copied ? <IconCheck size={14} /> : null}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={() => onUse(recommended.email, recommended.password)}
        className="mt-3 flex w-full items-center justify-between gap-3 rounded-control bg-accent px-3 py-3 text-left text-accent-ink transition-[filter] hover:brightness-110 disabled:opacity-45"
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold">Continue as {recommended.name}</span>
          <span className="mt-0.5 block truncate text-xs text-accent-ink">
            {recommended.blurb} – {recommended.email}
          </span>
        </span>
      </button>

      <ul className="mt-2 flex max-h-72 flex-col overflow-y-auto">
        {rest.map((a) => (
          <li key={a.email}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onUse(a.email, a.password)}
              className="flex w-full flex-col rounded-control px-2 py-2 text-left hover:bg-surface disabled:opacity-45"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-ink">{a.name}</span>
                <span className="mono truncate text-[11px] text-muted">{a.email}</span>
              </span>
              <span className="text-xs text-muted">
                {a.blurb}
                {shared ? "" : ` – ${a.password}`}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
