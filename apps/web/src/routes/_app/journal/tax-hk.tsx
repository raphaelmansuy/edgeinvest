import { createFileRoute } from "@tanstack/react-router";
import { screenOptions } from "../../../lib/screen";
import { TaxScreen } from "../../../screens/journal/tax";

export const Route = createFileRoute("/_app/journal/tax-hk")({ ...screenOptions("SCR-051"), component: TaxScreen });
