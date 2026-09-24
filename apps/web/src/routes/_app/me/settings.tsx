import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../lib/screen";
import { SettingsScreen } from "../../../screens/me/settings";

export const Route = createFileRoute("/_app/me/settings")({ ...screenOptions("SCR-070"), component: SettingsScreen });
