import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../../../lib/screen";
import { GameScreen } from "../../../../../screens/game/play";

export const Route = createFileRoute("/_app/learn/game/crash/$scenarioId")({
  ...screenOptions("SCR-010"),
  validateSearch: (s: Record<string, unknown>) => ({ attempt: typeof s.attempt === "string" ? s.attempt : undefined }),
  component: function CrashGameRoute() {
    const { scenarioId } = Route.useParams();
    return <GameScreen mode="crash" scenarioId={scenarioId} scr="SCR-010" />;
  },
});
