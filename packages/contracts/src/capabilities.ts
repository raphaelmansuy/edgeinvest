import type { EnvelopeId, Phase } from "@edge/domain";
import type { Guard } from "./screens";

/** Server-computed flags that drive every guard and lock (docs/04 §5). */
export interface Capabilities {
  authenticated: boolean;
  onboarded: boolean;
  phase: Phase;
  phase_cash_put: boolean;
  phase_shares_held: boolean;
  open_short_put: boolean;
  open_cycle: boolean;
  open_cycle_id: string | null;
  mastery_all_pass: boolean;
  mentor_selectable: boolean;
  live_eligible: boolean;
  live_blockers: string[];
  can_prepare_draft: boolean;
  agent_available: boolean;
  halted: boolean;
  halt_reason: string | null;
  mode: "paper" | "live";
  envelope_id: EnvelopeId;
  envelope_override: boolean;
  lots_open: number;
  lots_max: number;
  reserved_usd: string;
  leftover_usd: string;
  settled_usd: string | null;
  copy_version: string;
  pending_disclosures: string[];
  user: { email: string; display_name: string | null; jurisdiction: string | null; theme: "system" | "light" | "dark" } | null;
}

export const ANONYMOUS: Capabilities = {
  authenticated: false, onboarded: false, phase: "cash-put", phase_cash_put: true, phase_shares_held: false,
  open_short_put: false, open_cycle: false, open_cycle_id: null, mastery_all_pass: false, mentor_selectable: false,
  live_eligible: false, live_blockers: [], can_prepare_draft: false, agent_available: false, halted: false, halt_reason: null,
  mode: "paper", envelope_id: "beginner_v1", envelope_override: false, lots_open: 0, lots_max: 1, reserved_usd: "0.0000",
  leftover_usd: "0.0000", settled_usd: null, copy_version: "v1", pending_disclosures: [], user: null,
};

/** One evaluation for guards on both sides (DRY): web router and API capability checks. */
export function guardPasses(guard: Guard, c: Capabilities): boolean {
  switch (guard) {
    case "public": return true;
    case "authenticated": return c.authenticated;
    case "onboarded": return c.authenticated && c.onboarded;
    default: return c.authenticated && c.onboarded && c[guard];
  }
}
