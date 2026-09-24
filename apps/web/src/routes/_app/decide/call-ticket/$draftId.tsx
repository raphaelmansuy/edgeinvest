import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../../lib/screen";
import { CallTicketScreen } from "../../../../screens/decide/call-ticket";

export const Route = createFileRoute("/_app/decide/call-ticket/$draftId")({
  ...screenOptions("SCR-038"),
  component: function CallTicketRoute() {
    const { draftId } = Route.useParams();
    return <CallTicketScreen draftId={draftId} />;
  },
});
