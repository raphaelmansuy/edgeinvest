import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../../lib/screen";
import { GameScreen } from "../../../../screens/game/play";

export const Route = createFileRoute("/_app/learn/game/post-assign")({
  ...screenOptions("SCR-012"),
  validateSearch: (s: Record<string, unknown>) => ({ attempt: typeof s.attempt === "string" ? s.attempt : undefined }),
  component: () => <GameScreen mode="post_assign" scenarioId="post-assign" scr="SCR-012" />,
});
