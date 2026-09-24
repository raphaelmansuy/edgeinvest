import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../lib/screen";
import { QuarterlyLedgerScreen } from "../../../screens/execute/ledger";

export const Route = createFileRoute("/_app/execute/quarterly-ledger")({ ...screenOptions("SCR-046"), component: QuarterlyLedgerScreen });
