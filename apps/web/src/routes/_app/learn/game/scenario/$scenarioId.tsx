import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../../../lib/screen";
import { GameScreen } from "../../../../../screens/game/play";

export const Route = createFileRoute("/_app/learn/game/scenario/$scenarioId")({
  ...screenOptions("SCR-009"),
  validateSearch: (s: Record<string, unknown>) => ({ attempt: typeof s.attempt === "string" ? s.attempt : undefined }),
  component: function ScenarioRoute() {
    const { scenarioId } = Route.useParams();
    const mode = scenarioId === "paper-lab" ? "paper_lab" : "scenario";
    return <GameScreen mode={mode} scenarioId={scenarioId} scr="SCR-009" />;
  },
});
