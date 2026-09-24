/** mulberry32: 32-bit seeded PRNG, reproducible across JS engines. Every seeded surface (sim, quizzes, game) uses this one. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T>(rnd: () => number, xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
export const intBetween = (rnd: () => number, lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
export function shuffle<T>(rnd: () => number, xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
