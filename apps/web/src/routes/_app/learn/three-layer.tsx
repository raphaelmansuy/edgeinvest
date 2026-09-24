import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../lib/screen";
import { ModuleScreen } from "../../../screens/learn/module";

export const Route = createFileRoute("/_app/learn/three-layer")({ ...screenOptions("SCR-003"), component: () => <ModuleScreen slug="three-layer" scr="SCR-003" /> });
