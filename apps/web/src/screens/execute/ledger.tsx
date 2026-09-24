import { MoneyText, SignedBars } from "@edge/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Screen } from "../../components/kit";
import { ledgerQuery } from "../../lib/queries";

export function QuarterlyLedgerScreen() {
  const data = useSuspenseQuery(ledgerQuery("quarter")).data;
  const items = data.groups.map((g) => ({ label: g.label, credit: Number(g.credits), debit: Number(g.debits) }));
  return (
    <Screen scr="SCR-046" eyebrow="Execute" title="Quarterly ledger"
      lead={`${data.quarters} quarter${data.quarters === 1 ? "" : "s"} with entries. Premium received ${data.premium_received} USD. One quiet quarter is not an annual return.`}>
      <SignedBars items={items} caption="Credits and debits by quarter" />
      <div className="overflow-x-auto rounded-card border border-hair">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs text-muted"><tr>{["Date", "Quarter", "Kind", "Amount"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-hair">
            {data.entries.map((e) => (
              <tr key={e.entry_id}>
                <td className="num px-3 py-1.5">{e.trade_date}</td>
                <td className="px-3 py-1.5">{e.quarter_label}</td>
                <td className="px-3 py-1.5">{e.kind}</td>
                <td className="num px-3 py-1.5"><MoneyText value={e.amount_usd} sign /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Screen>
  );
}
