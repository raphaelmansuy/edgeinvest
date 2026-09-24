import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../lib/screen";
import { ModeScreen } from "../../../screens/me/mode";

export const Route = createFileRoute("/_app/me/mode")({ ...screenOptions("SCR-072"), component: ModeScreen });
