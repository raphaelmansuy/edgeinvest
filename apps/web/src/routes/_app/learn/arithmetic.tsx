import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../lib/screen";
import { ArithmeticScreen } from "../../../screens/learn/arithmetic";

export const Route = createFileRoute("/_app/learn/arithmetic")({ ...screenOptions("SCR-004"), component: ArithmeticScreen });
