import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../../lib/screen";
import { PlaybookScreen } from "../../../../screens/execute/playbook";

export const Route = createFileRoute("/_app/execute/call-playbook/$draftId")({
  ...screenOptions("SCR-043"),
  component: function CallPlaybookRoute() {
    const { draftId } = Route.useParams();
    return <PlaybookScreen draftId={draftId} putCall="C" />;
  },
});
