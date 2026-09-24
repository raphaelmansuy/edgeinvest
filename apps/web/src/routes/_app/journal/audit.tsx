import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../lib/screen";
import { AuditScreen } from "../../../screens/journal/audit";

export const Route = createFileRoute("/_app/journal/audit")({ ...screenOptions("SCR-050"), component: AuditScreen });
