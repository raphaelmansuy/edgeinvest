import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../lib/screen";
import { PutLockScreen } from "../../../screens/decide/put-lock";

export const Route = createFileRoute("/_app/decide/put-lock")({ ...screenOptions("SCR-039"), component: PutLockScreen });
