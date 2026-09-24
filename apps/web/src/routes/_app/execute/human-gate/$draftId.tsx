import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../../lib/screen";
import { GateScreen } from "../../../../screens/execute/gate";

export const Route = createFileRoute("/_app/execute/human-gate/$draftId")({
  ...screenOptions("SCR-042"),
  component: function GateRoute() {
    const { draftId } = Route.useParams();
    return <GateScreen draftId={draftId} />;
  },
});
