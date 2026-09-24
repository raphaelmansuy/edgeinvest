export * from "./backtest";
export * from "./bs";
export * from "./crash";
export * from "./datasets";
export * from "./mc";
export * from "./payoff";

export const SIM_DISCLAIMER =
  "Educational simulation. Not a forecast. Meeting ~7–8 % is illustrative only, not a floor. Annualising one quiet quarter is misleading.";
export const BACKTEST_DISCLAIMER =
  "Premiums are a Black-Scholes proxy using VXN implied volatility, not traded prices. Unconfirmed until an options-history source is chosen.";
