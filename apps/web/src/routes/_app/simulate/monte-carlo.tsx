import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../lib/screen";
import { MonteCarloScreen } from "../../../screens/simulate/mc";

export const Route = createFileRoute("/_app/simulate/monte-carlo")({ ...screenOptions("SCR-022"), component: MonteCarloScreen });
