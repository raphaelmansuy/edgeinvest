import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../lib/screen";
import { PayoffScreen } from "../../../screens/simulate/payoff";

export const Route = createFileRoute("/_app/simulate/payoff")({ ...screenOptions("SCR-020"), component: PayoffScreen });
