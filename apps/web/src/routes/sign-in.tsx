import { createFileRoute, redirect } from "@tanstack/react-router";
import * as z from "zod";
import { capabilitiesQuery } from "../lib/queries";
import { SignInScreen } from "../screens/auth/sign-in";

export const Route = createFileRoute("/sign-in")({
  staticData: { scr: "SCR-100" },
  validateSearch: z.object({ redirect: z.string().optional() }),
  beforeLoad: async ({ context }) => {
    const caps = await context.queryClient.ensureQueryData(capabilitiesQuery());
    if (caps.authenticated) throw redirect({ to: "/" });
  },
  component: SignInScreen,
});
