import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../lib/screen";
import { WillingnessScreen } from "../../../screens/decide/willingness";

export const Route = createFileRoute("/_app/decide/willingness")({ ...screenOptions("SCR-035"), component: WillingnessScreen });
