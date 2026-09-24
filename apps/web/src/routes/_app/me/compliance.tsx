import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../lib/screen";
import { ComplianceScreen } from "../../../screens/me/compliance";

export const Route = createFileRoute("/_app/me/compliance")({ ...screenOptions("SCR-073"), component: ComplianceScreen });
