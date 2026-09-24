import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../../lib/screen";
import { AssignmentScreen } from "../../../../screens/decide/assignment";

export const Route = createFileRoute("/_app/decide/assignment/$cycleId")({
  ...screenOptions("SCR-034"),
  component: function AssignmentRoute() {
    const { cycleId } = Route.useParams();
    return <AssignmentScreen cycleId={cycleId} />;
  },
});
