import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../lib/screen";
import { HomeScreen } from "../../screens/home/home";

export const Route = createFileRoute("/_app/")({ ...screenOptions("SCR-000"), component: HomeScreen });
