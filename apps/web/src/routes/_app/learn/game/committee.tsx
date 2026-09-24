import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../../lib/screen";
import { GameScreen } from "../../../../screens/game/play";

export const Route = createFileRoute("/_app/learn/game/committee")({
  ...screenOptions("SCR-011"),
  validateSearch: (s: Record<string, unknown>) => ({ attempt: typeof s.attempt === "string" ? s.attempt : undefined }),
  component: () => <GameScreen mode="committee" scenarioId="committee" scr="SCR-011" />,
});
