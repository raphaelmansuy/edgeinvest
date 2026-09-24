import { type Area, guardPasses, NAV, SCREENS, type ScrId } from "@edge/contracts";
import { APPROVED, HALT_TEXT } from "@edge/copy";
import {
  Button,
  ComplianceBanner,
  CopyText,
  cx,
  EnvelopeBadge,
  HaltBanner,
  IconBot,
  IconLogOut,
  IconMenu,
  IconMoon,
  IconSun,
  IconUser,
  IconX,
  Logo,
  LotsMeter,
  ModeChip,
  PaperBar,
  PhaseChip,
  ReservedLeftoverBar,
  Spinner,
} from "@edge/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Suspense, useEffect, useRef, useState } from "react";
import { api, idem, unwrap } from "../lib/api";
import { useCaps, useCurrentScr } from "../lib/screen";
import { applyTheme, storedTheme } from "../lib/theme";
import { AgentDrawer } from "./agent-drawer";
import { LockedScreen } from "./locked";

const AREA_OF_NAV: Record<Area, (typeof NAV)[number]["area"] | "me" | null> = {
  auth: null,
  shell: null,
  learn: "learn",
  game: "learn",
  simulate: "simulate",
  decide: "decide",
  share: "decide",
  execute: "execute",
  journal: "journal",
  agent: "agent",
  me: "me",
};

export function AppShell() {
  const caps = useCaps();
  const scr = useCurrentScr();
  const screen = scr ? SCREENS[scr] : undefined;
  const [agentOpen, setAgentOpen] = useState(() => sessionStorage.getItem("edge.agent") === "1");
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const online = useOnline();
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (caps.user?.theme && caps.user.theme !== storedTheme()) applyTheme(caps.user.theme);
  }, [caps.user?.theme]);
  useRequiredView(scr);

  const locked = screen && !guardPasses(screen.guard, caps) && !("fallback" in screen && screen.fallback);
  const activeArea = screen ? AREA_OF_NAV[screen.area] : null;
  const banner = screen?.banner ?? "sticky";
  const execute = screen?.area === "execute";
  const agentScreen = scr === "SCR-060" || scr === "SCR-041";
  const toggleAgent = () => {
    const n = !agentOpen;
    setAgentOpen(n);
    sessionStorage.setItem("edge.agent", n ? "1" : "0");
  };
  const onboarded = caps.onboarded;

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-raised focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-hair bg-bg">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="shrink-0" aria-label="EdgeInvest home">
            <Logo />
          </Link>
          {onboarded && (
            <nav aria-label="Primary" className="hidden items-center gap-0.5 lg:flex">
              {NAV.map((n) => (
                <NavLink key={n.area} to={n.to} active={activeArea === n.area}>
                  {n.label}
                </NavLink>
              ))}
              <NavLink to="/me/settings" active={activeArea === "me"}>
                Me
              </NavLink>
            </nav>
          )}
          <div className="ml-auto flex items-center gap-2">
            <ModeChip mode={caps.mode} />
            <ThemeButton />
            {onboarded && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleAgent}
                aria-pressed={agentOpen}
                aria-label="Toggle tutor drawer"
                className="hidden sm:inline-flex"
                icon={<IconBot size={16} />}
              >
                Tutor
              </Button>
            )}
            <UserMenu email={caps.user?.email ?? ""} />
            {onboarded && (
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                aria-label="Open menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(!menuOpen)}
              >
                {menuOpen ? <IconX size={18} /> : <IconMenu size={18} />}
              </Button>
            )}
          </div>
        </div>
        {menuOpen && (
          <nav aria-label="Primary mobile" className="animate-slide-down border-t border-hair bg-bg px-4 py-3 lg:hidden">
            <ul className="grid grid-cols-2 gap-1 sm:grid-cols-4">
              {[...NAV, { area: "me", label: "Me", to: "/me/settings" } as const].map((n) => (
                <li key={n.area}>
                  <NavLink to={n.to} active={activeArea === n.area} block>
                    {n.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {onboarded && (
          <div className="border-t border-hair bg-surface">
            <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2 sm:px-6" data-testid="chrome-row">
              <PhaseChip phase={caps.phase} />
              <LotsMeter open={caps.lots_open} max={caps.lots_max} />
              <ReservedLeftoverBar reserved={caps.reserved_usd} leftover={caps.leftover_usd} />
              <EnvelopeBadge envelopeId={caps.envelope_id} override={caps.envelope_override} />
              <span className="text-xs text-muted">
                Mentor:{" "}
                <span className={cx("font-medium", caps.mentor_selectable ? "text-ok" : "text-ink")}>
                  {caps.mentor_selectable ? "available" : "locked"}
                </span>
              </span>
            </div>
          </div>
        )}
      </header>

      {caps.halted && caps.halt_reason && (
        <div className="mx-auto w-full max-w-[1400px] px-4 pt-4 sm:px-6">
          <HaltBanner
            reason={caps.halt_reason}
            action={
              <Link to={HALT_TEXT[caps.halt_reason]?.to ?? "/execute/halt"} className="text-sm font-semibold text-accent hover:underline">
                {HALT_TEXT[caps.halt_reason]?.action.split(".")[0] ?? "Resolve"}
              </Link>
            }
          />
        </div>
      )}
      {!online && (
        <div role="status" className="mx-auto mt-3 w-full max-w-[1400px] px-4 sm:px-6">
          <p className="rounded-control border border-caution/40 bg-caution/10 px-4 py-2 text-sm font-medium">
            You are offline. Changes are paused; cached screens stay visible.
          </p>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 gap-6 px-4 pb-24 sm:px-6">
        <main id="main" className="min-w-0 flex-1 py-6 sm:py-8" data-scr-current={scr}>
          {execute && caps.mode === "paper" && (
            <div className="mb-4">
              <PaperBar />
            </div>
          )}
          <Suspense
            fallback={
              <div className="flex items-center gap-2 py-10 text-sm text-muted">
                <Spinner /> Loading…
              </div>
            }
          >
            {locked && scr ? <LockedScreen scr={scr} /> : <Outlet />}
          </Suspense>
        </main>
        {agentOpen && onboarded && scr !== "SCR-060" && <AgentDrawer onClose={toggleAgent} scr={scr} />}
      </div>

      <div className="sticky bottom-0 z-20 bg-banner/95 shadow-[0_-8px_24px_-16px_rgb(27_36_33/0.35)] backdrop-blur-sm">
        <ComplianceBanner
          banner={banner === "footer" ? "sticky" : banner}
          detailsHref="/me/compliance"
          extra={
            execute || agentScreen || scr === "SCR-072" ? <RequiredExtra scr={scr} execute={execute} agent={agentScreen} /> : undefined
          }
        />
      </div>
    </div>
  );
}

function RequiredExtra({ scr, execute, agent }: { scr?: ScrId; execute: boolean; agent: boolean }) {
  return (
    <span className="flex flex-col gap-0.5 font-medium">
      {execute && <CopyText text={APPROVED["exec.human_gate"]} />}
      {agent && <CopyText text={APPROVED["agent.not_advice"]} />}
      {scr === "SCR-072" && (
        <span>Live mode uses your real account. Every rule still applies and you still place every order yourself.</span>
      )}
    </span>
  );
}

function NavLink({ to, active, children, block }: { to: string; active: boolean; children: React.ReactNode; block?: boolean }) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={cx(
        "rounded-control px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        block && "block py-2.5",
        active ? "bg-accent/10 text-accent" : "text-muted hover:bg-surface hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}

function ThemeButton() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => {
        applyTheme(dark ? "light" : "dark");
        setDark(!dark);
      }}
    >
      {dark ? <IconSun size={16} /> : <IconMoon size={16} />}
    </Button>
  );
}

function UserMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const signOut = async () => {
    await unwrap(api.auth["sign-out"].$post({ query: {} }, idem(crypto.randomUUID()))).catch(() => null);
    qc.clear();
    await navigate({ to: "/sign-in" });
  };
  const focusTrigger = () => rootRef.current?.querySelector<HTMLButtonElement>("button[aria-haspopup]")?.focus();
  const menuItems = () => Array.from(rootRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']") ?? []);
  useEffect(() => {
    if (!open) return;
    const items = menuItems();
    items[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        focusTrigger();
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
      const list = menuItems();
      if (!list.length) return;
      const i = list.findIndex((el) => el === document.activeElement);
      let next = i;
      if (e.key === "ArrowDown") next = i < 0 ? 0 : (i + 1) % list.length;
      if (e.key === "ArrowUp") next = i < 0 ? list.length - 1 : (i - 1 + list.length) % list.length;
      if (e.key === "Home") next = 0;
      if (e.key === "End") next = list.length - 1;
      e.preventDefault();
      list[next]?.focus();
    };
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    addEventListener("keydown", onKey);
    addEventListener("mousedown", onPointer);
    return () => {
      removeEventListener("keydown", onKey);
      removeEventListener("mousedown", onPointer);
    };
  }, [open]);
  return (
    <div className="relative" ref={rootRef}>
      <Button
        variant="ghost"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        aria-label="Account menu"
        icon={<IconUser size={16} />}
      />
      {open && (
        <div role="menu" aria-label="Account" className="animate-fade-in absolute right-0 mt-2 w-60 rounded-card border border-hair bg-raised p-1.5 shadow-pop">
          <p className="truncate px-3 py-2 text-xs text-muted" id="account-email">
            {email}
          </p>
          <Link
            role="menuitem"
            to="/me/settings"
            className="block rounded-control px-3 py-2 text-sm hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>
          <Link
            role="menuitem"
            to="/me/compliance"
            className="block rounded-control px-3 py-2 text-sm hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={() => setOpen(false)}
          >
            Compliance
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-control px-3 py-2 text-left text-sm text-loss hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <IconLogOut size={15} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function useOnline() {
  const [on, setOn] = useState(() => navigator.onLine);
  useEffect(() => {
    const up = () => setOn(true),
      down = () => setOn(false);
    addEventListener("online", up);
    addEventListener("offline", down);
    return () => {
      removeEventListener("online", up);
      removeEventListener("offline", down);
    };
  }, []);
  return on;
}

/** Every view of a required disclosure is audited (docs/12 §4). */
function useRequiredView(scr?: ScrId) {
  useEffect(() => {
    if (!scr) return;
    const s = SCREENS[scr];
    const key =
      s.area === "execute"
        ? "exec.human_gate"
        : scr === "SCR-060" || scr === "SCR-041"
          ? "agent.not_advice"
          : scr === "SCR-072"
            ? "live.unlock"
            : null;
    if (!key || s.banner === "sticky") return;
    void api.me.disclosures[":key"].view.$post({ param: { key }, query: { scr } }, idem(crypto.randomUUID())).catch(() => null);
  }, [scr]);
}
