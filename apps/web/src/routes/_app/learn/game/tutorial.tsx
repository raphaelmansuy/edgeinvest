import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../../lib/screen";
import { GameScreen } from "../../../../screens/game/play";

export const Route = createFileRoute("/_app/learn/game/tutorial")({
  ...screenOptions("SCR-008"),
  validateSearch: (s: Record<string, unknown>) => ({ attempt: typeof s.attempt === "string" ? s.attempt : undefined }),
  component: () => <GameScreen mode="tutorial" scenarioId="tutorial" scr="SCR-008" />,
});
