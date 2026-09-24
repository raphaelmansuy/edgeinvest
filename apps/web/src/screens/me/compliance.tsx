import { COPY_VERSION, DISCLOSURES } from "@edge/copy";
import { Checkbox, CopyText } from "@edge/ui";
import { useQuery } from "@tanstack/react-query";
import { Err, ME_NAV, Screen } from "../../components/kit";
import { api, idem, unwrap } from "../../lib/api";
import { useIntent } from "../../lib/mutation";
import { disclosuresQuery, qk } from "../../lib/queries";

export function ComplianceScreen() {
  const disc = useQuery(disclosuresQuery());
  const rows = disc.data?.disclosures ?? [];
  const acked = new Set(rows.filter((d: { acked_at: string | null }) => d.acked_at).map((d: { key: string }) => d.key));
  const ack = useIntent((k: string, key) => unwrap(api.me.disclosures[":key"].ack.$post({ param: { key: k }, json: { copy_version: COPY_VERSION, scr: "SCR-073" } }, idem(key))),
    { invalidate: [qk.disclosures], caps: true });
  return (
    <Screen scr="SCR-073" eyebrow="Me" title="Disclosures" nav={ME_NAV} lead={`Copy version ${COPY_VERSION}. A new version asks again.`}>
      <div className="flex flex-col gap-3">
        {DISCLOSURES.map((d) => (
          <details key={d.key} className="rounded-card border border-hair bg-raised px-4 py-3" open={!acked.has(d.key)}>
            <summary className="cursor-pointer font-medium text-ink">{d.title}</summary>
            <p className="mt-2 text-sm leading-relaxed"><CopyText text={d.body} /></p>
            <Checkbox className="mt-3" label={acked.has(d.key) ? "Acknowledged" : "I have read this"} checked={acked.has(d.key)} disabled={acked.has(d.key) || ack.isPending}
              onChange={(e) => e.target.checked && ack.mutate(d.key)} />
          </details>
        ))}
      </div>
      <Err error={ack.error} />
    </Screen>
  );
}
