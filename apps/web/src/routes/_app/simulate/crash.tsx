import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../lib/screen";
import { CrashScreen } from "../../../screens/simulate/crash";

export const Route = createFileRoute("/_app/simulate/crash")({ ...screenOptions("SCR-021"), component: CrashScreen });
