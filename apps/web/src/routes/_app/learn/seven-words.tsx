import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../lib/screen";
import { SevenWordsScreen } from "../../../screens/learn/seven-words";

export const Route = createFileRoute("/_app/learn/seven-words")({ ...screenOptions("SCR-002"), component: SevenWordsScreen });
