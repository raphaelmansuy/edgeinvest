import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../lib/screen";
import { LessonsScreen } from "../../../screens/journal/lessons";

export const Route = createFileRoute("/_app/journal/lessons")({ ...screenOptions("SCR-052"), component: LessonsScreen });
