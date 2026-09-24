import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../lib/screen";
import { WheelLearnScreen } from "../../../screens/learn/wheel-mod";

export const Route = createFileRoute("/_app/learn/wheel")({ ...screenOptions("SCR-005"), component: WheelLearnScreen });
