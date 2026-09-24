import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../lib/screen";
import { InputsScreen } from "../../../screens/decide/inputs";

export const Route = createFileRoute("/_app/decide/inputs")({ ...screenOptions("SCR-102"), component: InputsScreen });
