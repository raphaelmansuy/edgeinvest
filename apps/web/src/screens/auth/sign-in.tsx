import { SignInReq } from "@edge/contracts";
import { APPROVED, UI } from "@edge/copy";
import { Button, CopyText, Field, HeroArt, IconShield, Logo, ProblemAlert, TextInput } from "@edge/ui";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { type ApiProblem, api, unwrap } from "../../lib/api";
import { qk } from "../../lib/queries";
import { DevAccounts } from "./dev-accounts";

const route = getRouteApi("/sign-in");

export function SignInScreen() {
  const search = route.useSearch();
  const router = useRouter();
  const qc = useQueryClient();
  const [err, setErr] = useState<ApiProblem | null>(null);
  const form = useForm({
    defaultValues: { email: "", password: "" },
    validators: { onSubmit: SignInReq },
    onSubmit: async ({ value }) => {
      setErr(null);
      try {
        await unwrap(api.auth["sign-in"].$post({ json: value }, { headers: { "Idempotency-Key": crypto.randomUUID() } }));
        // Drop the anonymous capabilities cache. ensureQueryData would otherwise reuse it and bounce back here.
        qc.removeQueries({ queryKey: qk.caps });
        const to = search.redirect?.startsWith("/") && !search.redirect.startsWith("//") ? search.redirect : "/";
        await router.navigate({ to });
      } catch (e) {
        setErr(e as ApiProblem);
      }
    },
  });

  function signInAs(email: string, password: string) {
    form.setFieldValue("email", email);
    form.setFieldValue("password", password);
    void form.handleSubmit();
  }

  return (
    <main className="min-h-dvh lg:grid lg:h-dvh lg:grid-cols-[1.1fr_1fr]">
      <a
        href="#sign-in-form"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-raised focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-ink focus:shadow-pop"
      >
        Skip to sign-in form
      </a>
      <section className="relative hidden overflow-hidden border-r border-hair bg-surface lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="bg-grid absolute inset-0 opacity-50" aria-hidden />
        <Logo className="relative text-lg" />
        <div className="relative">
          <HeroArt className="mb-10 w-full max-w-lg" />
          <h2 className="font-display max-w-md text-3xl leading-snug text-ink">Premium and discipline, not a lottery ticket.</h2>
          <p className="mt-3 max-w-md text-muted">
            Learn the cash-secured put on QQQ, replay the crashes, and write a decision memo before any draft exists.
          </p>
        </div>
        <p className="relative flex items-center gap-2 text-xs text-muted">
          <IconShield size={14} /> No broker connection. No submit button. Ever.
        </p>
      </section>

      <section className="overflow-y-auto bg-bg px-6 py-12 sm:px-12">
        <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center">
          <Logo className="mb-10 lg:hidden" />
          <p className="num mb-2 text-xs font-medium text-muted" data-scr="SCR-100">
            SCR-100
          </p>
          <h1 className="font-display text-2xl text-ink sm:text-[1.85rem]">Sign in</h1>
          <p className="mt-1 text-sm text-muted">{UI.tagline}</p>

          <form
            id="sign-in-form"
            className="mt-8 flex flex-col gap-5"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void form.handleSubmit();
            }}
          >
            <form.Field name="email">
              {(f) => (
                <Field
                  label="Email"
                  htmlFor="email"
                  error={f.state.meta.isTouched || form.state.submissionAttempts ? firstError(f.state.meta.errors) : null}
                >
                  <TextInput
                    id="email"
                    type="email"
                    autoComplete="username"
                    value={f.state.value}
                    autoFocus
                    onChange={(e) => f.handleChange(e.target.value)}
                    onBlur={f.handleBlur}
                    invalid={!!f.state.meta.errors.length}
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="password">
              {(f) => (
                <Field label="Password" htmlFor="password" error={form.state.submissionAttempts ? firstError(f.state.meta.errors) : null}>
                  <TextInput
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={f.state.value}
                    onChange={(e) => f.handleChange(e.target.value)}
                    onBlur={f.handleBlur}
                    invalid={!!f.state.meta.errors.length}
                  />
                </Field>
              )}
            </form.Field>
            {err && (
              <ProblemAlert problem={{ ...err.problem, title: err.status === 401 ? "Email or password is wrong" : err.problem.title }} />
            )}
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(busy) => (
                <Button type="submit" variant="primary" size="lg" disabled={busy} className="w-full">
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
              )}
            </form.Subscribe>
          </form>

          <form.Subscribe selector={(s) => s.isSubmitting}>{(busy) => <DevAccounts busy={busy} onUse={signInAs} />}</form.Subscribe>

          <p
            className="mt-10 border-t border-hair pt-4 text-xs leading-relaxed text-muted"
            data-testid="compliance-banner"
            data-banner="footer"
          >
            <CopyText text={APPROVED["edu.sticky"]} />
          </p>
        </div>
      </section>
    </main>
  );
}

function firstError(errors: unknown[]): string | null {
  const e = errors[0];
  if (!e) return null;
  if (typeof e === "string") return e;
  if (typeof e === "object" && e && "message" in e) return String((e as { message: string }).message);
  return "Invalid";
}
