import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../lib/screen";
import { BacktestScreen } from "../../../screens/simulate/backtest";

export const Route = createFileRoute("/_app/simulate/backtest")({ ...screenOptions("SCR-023"), component: BacktestScreen });
