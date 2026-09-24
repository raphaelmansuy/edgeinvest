import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../../lib/screen";
import { PacketScreen } from "../../../../screens/decide/packet";

export const Route = createFileRoute("/_app/decide/call-packet/$memoId")({
  ...screenOptions("SCR-037"),
  validateSearch: (s: Record<string, unknown>) => ({ candidate: typeof s.candidate === "string" ? s.candidate : undefined }),
  component: function CallPacketRoute() {
    const { memoId } = Route.useParams();
    return <PacketScreen phase="shares-held" memoId={memoId} />;
  },
});
