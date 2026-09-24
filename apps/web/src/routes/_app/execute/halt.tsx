import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../lib/screen";
import { HaltScreen } from "../../../screens/execute/halt";

export const Route = createFileRoute("/_app/execute/halt")({ ...screenOptions("SCR-045"), component: HaltScreen });
