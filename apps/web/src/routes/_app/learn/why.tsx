import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../lib/screen";
import { ModuleScreen } from "../../../screens/learn/module";

export const Route = createFileRoute("/_app/learn/why")({ ...screenOptions("SCR-001"), component: () => <ModuleScreen slug="why" scr="SCR-001" /> });
