import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../../lib/screen";
import { PacketScreen } from "../../../../screens/decide/packet";

export const Route = createFileRoute("/_app/decide/packet/$memoId")({
  ...screenOptions("SCR-032"),
  validateSearch: (s: Record<string, unknown>) => ({ candidate: typeof s.candidate === "string" ? s.candidate : undefined }),
  component: function PacketRoute() {
    const { memoId } = Route.useParams();
    return <PacketScreen phase="cash-put" memoId={memoId} />;
  },
});
