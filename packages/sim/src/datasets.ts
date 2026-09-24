import crashCovid from "../data/crash/covid_2020.json";
import crashDotcom from "../data/crash/dotcom_2000.json";
import crashGfc from "../data/crash/gfc_2008.json";
import manifest from "../data/manifest.json";
import monthly from "../data/qqq-m-2001-2026-v1.json";
import quarterly from "../data/qqq-q-2010-2026-v1.json";

export interface CrashScenario {
  id: string;
  version: number;
  title: string;
  narrative: string;
  start: string;
  end: string;
  weekly_dates: string[];
  weekly_close: number[];
  iv_path: number[];
  iv_source: string[];
  rf: number;
}

export const CRASH_SCENARIOS: Readonly<Record<string, CrashScenario>> = {
  dotcom_2000: crashDotcom,
  gfc_2008: crashGfc,
  covid_2020: crashCovid,
};
export type CrashId = "dotcom_2000" | "gfc_2008" | "covid_2020";
export const CRASH_IDS = ["dotcom_2000", "gfc_2008", "covid_2020"] as const satisfies readonly CrashId[];

export const QUARTERLY = quarterly;
export const MONTHLY = monthly;
export const MANIFEST = manifest;
export const DATASET_VERSION = quarterly.id;
export const BACKTEST_DATASET_VERSION = monthly.id;
