import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../../lib/screen";
import { GameHubScreen } from "../../../../screens/game/hub";

export const Route = createFileRoute("/_app/learn/game/")({ ...screenOptions("SCR-007"), component: GameHubScreen });
