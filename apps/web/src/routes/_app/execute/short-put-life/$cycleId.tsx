import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../../lib/screen";
import { CycleLifeScreen } from "../../../../screens/execute/life";

export const Route = createFileRoute("/_app/execute/short-put-life/$cycleId")({
  ...screenOptions("SCR-103"),
  component: function PutLifeRoute() {
    const { cycleId } = Route.useParams();
    return <CycleLifeScreen cycleId={cycleId} putCall="P" />;
  },
});
