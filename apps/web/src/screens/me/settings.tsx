import { Button, Card, CardBody, Field, MoneyInput, Select, TextInput, moneyError } from "@edge/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Err, ME_NAV, Screen, Stamp } from "../../components/kit";
import { api, idem, unwrap } from "../../lib/api";
import { useIntent } from "../../lib/mutation";
import { meQuery, qk } from "../../lib/queries";
import { applyTheme } from "../../lib/theme";
import { JURISDICTIONS } from "../auth/welcome";

export function SettingsScreen() {
  const me = useQuery(meQuery());
  const u = me.data;
  const [name, setName] = useState<string | null>(null);
  const [jur, setJur] = useState<string | null>(null);
  const [cash, setCash] = useState<string | null>(null);
  const [theme, setTheme] = useState<string | null>(null);
  const display = name ?? u?.display_name ?? "";
  const jurisdiction = jur ?? u?.jurisdiction ?? "HK";
  const startCash = cash ?? (u?.paper_start_cash ? String(Number(u.paper_start_cash)) : "100000");
  const themeValue = theme ?? u?.theme ?? "system";
  const save = useIntent((_: void, key) => unwrap(api.me.$patch({ json: {
    display_name: display || null, jurisdiction, paper_start_cash: startCash, theme: themeValue as "system" | "light" | "dark",
  } }, idem(key))), { invalidate: [qk.me], caps: true, onSuccess: () => applyTheme(themeValue as "system" | "light" | "dark") });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const signOut = async (all: boolean) => {
    await unwrap(api.auth["sign-out"].$post({ query: all ? { all: "1" } : {} }, idem(crypto.randomUUID())));
    qc.clear();
    await navigate({ to: "/sign-in" });
  };

  return (
    <Screen scr="SCR-070" eyebrow="Me" title="Settings" nav={ME_NAV} lead="Profile, paper-lab cash and sessions. Changing jurisdiction asks you to re-acknowledge the disclosures.">
      <Card>
        <CardBody className="grid max-w-lg gap-3">
          <Field label="Display name" htmlFor="name"><TextInput id="name" value={display} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Jurisdiction" htmlFor="jur">
            <Select id="jur" value={jurisdiction} onChange={(e) => setJur(e.target.value)}>
              {JURISDICTIONS.map(([c, l]) => <option key={c} value={c}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Paper start cash" htmlFor="cash" error={moneyError(startCash, { positive: true })}>
            <MoneyInput id="cash" value={startCash} onChange={(e) => setCash(e.target.value)} />
          </Field>
          <Field label="Theme" htmlFor="theme">
            <Select id="theme" value={themeValue} onChange={(e) => setTheme(e.target.value)}>
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </Select>
          </Field>
          <Button variant="primary" disabled={save.isPending || !!moneyError(startCash, { positive: true })} onClick={() => save.mutate()}>Save</Button>
          <Err error={save.error} />
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <p className="mb-2 text-sm font-medium">Sessions</p>
          <ul className="mb-3 space-y-1 text-sm text-muted">{(u?.sessions ?? []).map((s: { last_seen_at: string }, i: number) => <li key={i}>Last seen <Stamp at={s.last_seen_at} /></li>)}</ul>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void signOut(false)}>Sign out</Button>
            <Button variant="danger" onClick={() => void signOut(true)}>Sign out everywhere</Button>
          </div>
        </CardBody>
      </Card>
    </Screen>
  );
}
