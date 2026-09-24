import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../lib/screen";
import { AgentPage } from "../../screens/agent/chat";

export const Route = createFileRoute("/_app/agent")({ ...screenOptions("SCR-060"), component: AgentPage });
