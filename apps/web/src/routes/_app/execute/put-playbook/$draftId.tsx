import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../../lib/screen";
import { PlaybookScreen } from "../../../../screens/execute/playbook";

export const Route = createFileRoute("/_app/execute/put-playbook/$draftId")({
  ...screenOptions("SCR-040"),
  component: function PutPlaybookRoute() {
    const { draftId } = Route.useParams();
    return <PlaybookScreen draftId={draftId} putCall="P" />;
  },
});
