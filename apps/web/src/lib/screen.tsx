import { type Capabilities, SCREENS, type ScrId, guardPasses } from "@edge/contracts";
import { useSuspenseQuery } from "@tanstack/react-query";
import { redirect, useMatches } from "@tanstack/react-router";
import { capabilitiesQuery } from "./queries";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption { scr?: ScrId }
}

/** One guard for every screen (docs/08 §4): registry guard → registry fallback; no fallback ⇒ locked state in the shell. */
export const guardFor = (scr: ScrId) => ({ context }: { context: { caps?: Capabilities } }) => {
  const { guard } = SCREENS[scr];
  const fallback = (SCREENS[scr] as { fallback?: string }).fallback;
  const caps = context.caps;
  if (!caps) return;
  if (!guardPasses(guard, caps) && fallback) throw redirect({ to: fallback });
};

export const screenOptions = (scr: ScrId) => ({ staticData: { scr }, beforeLoad: guardFor(scr) });

export function useCurrentScr(): ScrId | undefined {
  const matches = useMatches();
  for (let i = matches.length - 1; i >= 0; i--) {
    const s = matches[i]!.staticData?.scr;
    if (s) return s;
  }
  return undefined;
}

/** Live capabilities (the shell observes the query, so invalidation refreshes every consumer). */
export function useCaps(): Capabilities {
  return useSuspenseQuery(capabilitiesQuery()).data;
}
