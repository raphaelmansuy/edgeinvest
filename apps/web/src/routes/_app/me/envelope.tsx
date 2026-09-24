import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../lib/screen";
import { EnvelopeScreen } from "../../../screens/me/envelope";

export const Route = createFileRoute("/_app/me/envelope")({ ...screenOptions("SCR-071"), component: EnvelopeScreen });
