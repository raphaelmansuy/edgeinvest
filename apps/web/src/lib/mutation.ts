import { type QueryKey, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useRef } from "react";
import type { ApiProblem } from "./api";
import { qk } from "./queries";

const newKey = () => crypto.randomUUID();

/**
 * One Idempotency-Key per user intent (docs/08 §6): created when the form mounts, reused on retry,
 * replaced after success. Capability-changing mutations set `caps` so guards re-run (EC-UX-005).
 */
export function useIntent<V, R>(
  fn: (vars: V, key: string) => Promise<R>,
  opts: { invalidate?: QueryKey[]; caps?: boolean; onSuccess?: (r: R, v: V) => void; onError?: (e: ApiProblem) => void } = {},
) {
  const key = useRef(newKey());
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation<R, ApiProblem, V>({
    mutationFn: (v) => fn(v, key.current),
    retry: 0,
    onSuccess: async (r, v) => {
      key.current = newKey();
      await Promise.all((opts.invalidate ?? []).map((k) => qc.invalidateQueries({ queryKey: k })));
      if (opts.caps) {
        await qc.invalidateQueries({ queryKey: qk.caps });
        await router.invalidate();
      }
      opts.onSuccess?.(r, v);
    },
    onError: (e) => {
      if (e.status >= 400 && e.status < 500 && e.code !== "IDEMPOTENCY_IN_PROGRESS") key.current = newKey();
      opts.onError?.(e);
    },
  });
}
