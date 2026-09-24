import { Button, Field, Select } from "@edge/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Err } from "../../components/kit";
import { api, idem, unwrap } from "../../lib/api";
import { useIntent } from "../../lib/mutation";
import { AFTER_WHEEL, memosQuery } from "../../lib/queries";

export function AttachResult({ kind, resultId }: { kind: "crash" | "mc"; resultId: string }) {
  const memos = useSuspenseQuery(memosQuery()).data;
  const building = memos.items.filter((m) => m.status === "building");
  const [memo, setMemo] = useState(building[0]?.memo_id ?? "");
  const attach = useIntent((_: void, key) => unwrap(api.memos[":id"].stress[":kind"].$put({
    param: { id: memo, kind }, json: { result_id: resultId },
  }, idem(key))), { invalidate: [...AFTER_WHEEL] });
  if (!building.length) return <p className="text-sm text-muted">Open a building memo to attach this run to a packet.</p>;
  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field label="Attach to memo" htmlFor="memo">
        <Select id="memo" value={memo} onChange={(e) => setMemo(e.target.value)}>
          {building.map((m) => <option key={m.memo_id} value={m.memo_id}>{m.phase} · {m.decision_date}</option>)}
        </Select>
      </Field>
      <Button variant="secondary" disabled={!memo || attach.isPending} onClick={() => attach.mutate()}>{attach.data ? "Attached" : "Attach"}</Button>
      <Err error={attach.error} />
    </div>
  );
}
