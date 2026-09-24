import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell } from "../components/shell";
import { RouteError } from "../components/errors";
import { capabilitiesQuery } from "../lib/queries";

const PRE_ONBOARDING = new Set(["/welcome", "/me/settings", "/me/compliance"]);

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    const caps = await context.queryClient.ensureQueryData(capabilitiesQuery());
    if (!caps.authenticated) throw redirect({ to: "/sign-in", search: { redirect: location.href } });
    if (!caps.onboarded && !PRE_ONBOARDING.has(location.pathname)) throw redirect({ to: "/welcome" });
    return { caps };
  },
  component: AppShell,
  errorComponent: RouteError,
});
