import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../lib/screen";
import { HistoryScreen } from "../../../screens/decide/history";

export const Route = createFileRoute("/_app/decide/history")({ ...screenOptions("SCR-033"), component: HistoryScreen });
