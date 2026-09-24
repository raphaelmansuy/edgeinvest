import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../lib/screen";
import { CandidatesScreen } from "../../../screens/decide/candidates";

export const Route = createFileRoute("/_app/decide/call-candidates")({
  ...screenOptions("SCR-036"),
  validateSearch: (s: Record<string, unknown>) => ({ candidate: typeof s.candidate === "string" ? s.candidate : undefined }),
  component: () => <CandidatesScreen phase="shares-held" />,
});
