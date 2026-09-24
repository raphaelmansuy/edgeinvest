import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../../lib/screen";
import { CycleLifeScreen } from "../../../../screens/execute/life";

export const Route = createFileRoute("/_app/execute/short-call-life/$cycleId")({
  ...screenOptions("SCR-044"),
  component: function CallLifeRoute() {
    const { cycleId } = Route.useParams();
    return <CycleLifeScreen cycleId={cycleId} putCall="C" />;
  },
});
