import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../lib/screen";
import { WelcomeScreen } from "../../screens/auth/welcome";

export const Route = createFileRoute("/_app/welcome")({ ...screenOptions("SCR-101"), component: WelcomeScreen });
