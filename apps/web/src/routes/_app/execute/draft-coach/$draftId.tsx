import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../../lib/screen";
import { CoachScreen } from "../../../../screens/execute/coach";

export const Route = createFileRoute("/_app/execute/draft-coach/$draftId")({
  ...screenOptions("SCR-041"),
  component: function CoachRoute() {
    const { draftId } = Route.useParams();
    return <CoachScreen draftId={draftId} />;
  },
});
