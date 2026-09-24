import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../lib/screen";
import { SnapshotScreen } from "../../../screens/decide/snapshot";

export const Route = createFileRoute("/_app/decide/snapshot")({ ...screenOptions("SCR-030"), component: SnapshotScreen });
