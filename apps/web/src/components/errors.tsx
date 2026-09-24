import { Button, EmptyArt, IconAlert, ProblemAlert, buttonClass } from "@edge/ui";
import { Link, type ErrorComponentProps, useRouter } from "@tanstack/react-router";
import { ApiProblem } from "../lib/api";

export function RootError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const p = error instanceof ApiProblem ? error.problem : { title: "Something went wrong", detail: error instanceof Error ? error.message : "Unexpected error" };
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-6">
      <p className="flex items-center gap-2 text-sm font-semibold text-loss"><IconAlert size={16} /> Unexpected error</p>
      <ProblemAlert problem={p} />
      <p className="text-sm text-muted">Nothing was sent to any broker. EdgeInvest never sends orders.</p>
      <div className="flex gap-2">
        <Button variant="primary" onClick={() => { reset(); router.invalidate(); }}>Try again</Button>
        <a href="/" className={buttonClass("secondary")}>Go home</a>
      </div>
    </main>
  );
}

export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const p = error instanceof ApiProblem ? error.problem : { title: "This screen failed to load", detail: error instanceof Error ? error.message : "This screen failed to load" };
  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <ProblemAlert problem={p} onRetry={() => { reset(); router.invalidate(); }} />
      <p className="text-sm text-muted">Nothing was sent to any broker.</p>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
      <EmptyArt kind="chart" />
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted">That address is not part of EdgeInvest. Everything starts from Home.</p>
      <Link to="/" className={buttonClass("primary")}>Go home</Link>
    </div>
  );
}
