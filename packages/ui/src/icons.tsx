import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = ({ size = 16, ...rest }: P) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, focusable: false, ...rest,
});
const make = (d: string | string[]) => (p: P) => (
  <svg {...base(p)}>{(Array.isArray(d) ? d : [d]).map((x) => <path key={x} d={x} />)}</svg>
);

export const IconCheck = make("M20 6 9 17l-5-5");
export const IconX = make(["M18 6 6 18", "M6 6l12 12"]);
export const IconAlert = make(["M12 9v4", "M12 17h.01", "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"]);
export const IconInfo = make(["M12 16v-4", "M12 8h.01", "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z"]);
export const IconLock = make(["M7 11V7a5 5 0 0 1 10 0v4", "M5 11h14v10H5z"]);
export const IconShield = make(["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", "m9 12 2 2 4-4"]);
export const IconClock = make(["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 6v6l4 2"]);
export const IconArrowRight = make(["M5 12h14", "m12 5 7 7-7 7"]);
export const IconArrowLeft = make(["M19 12H5", "m12 19-7-7 7-7"]);
export const IconChevronDown = make("m6 9 6 6 6-6");
export const IconChevronRight = make("m9 18 6-6-6-6");
export const IconBook = make(["M4 19.5A2.5 2.5 0 0 1 6.5 17H20", "M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"]);
export const IconChart = make(["M3 3v18h18", "m7 14 4-4 3 3 5-6"]);
export const IconCompass = make(["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "m16.2 7.8-2.1 6.3-6.3 2.1 2.1-6.3z"]);
export const IconPlay = make("M6 4l14 8-14 8z");
export const IconFlag = make(["M4 22V4", "M4 4h13l-2 4 2 4H4"]);
export const IconLayers = make(["m12 2 10 5-10 5L2 7z", "m2 17 10 5 10-5", "m2 12 10 5 10-5"]);
export const IconCalendar = make(["M3 5h18v16H3z", "M16 3v4", "M8 3v4", "M3 10h18"]);
export const IconMoon = make("M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z");
export const IconSun = make(["M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z", "M12 1v2", "M12 21v2", "M4.2 4.2l1.4 1.4", "M18.4 18.4l1.4 1.4", "M1 12h2", "M21 12h2", "M4.2 19.8l1.4-1.4", "M18.4 5.6l1.4-1.4"]);
export const IconMenu = make(["M3 6h18", "M3 12h18", "M3 18h18"]);
export const IconUser = make(["M20 21a8 8 0 0 0-16 0", "M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z"]);
export const IconLogOut = make(["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "m16 17 5-5-5-5", "M21 12H9"]);
export const IconBot = make(["M12 8V4H8", "M4 8h16v12H4z", "M2 14h2", "M20 14h2", "M9 13v2", "M15 13v2"]);
export const IconSend = make(["m22 2-7 20-4-9-9-4z", "M22 2 11 13"]);
export const IconDownload = make(["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "m7 10 5 5 5-5", "M12 15V3"]);
export const IconRefresh = make(["M21 12a9 9 0 1 1-2.6-6.4L21 8", "M21 3v5h-5"]);
export const IconWheel = make(["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M12 2v6", "M12 16v6", "M2 12h6", "M16 12h6"]);
export const IconHalt = make(["M7.9 2h8.2L22 7.9v8.2L16.1 22H7.9L2 16.1V7.9z", "M8 12h8"]);
export const IconScale = make(["M12 3v18", "M5 7h14", "m5 7-3 7a4 4 0 0 0 6 0z", "m19 7-3 7a4 4 0 0 0 6 0z"]);
export const IconEye = make(["M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"]);
export const IconPlus = make(["M12 5v14", "M5 12h14"]);
export const IconTrash = make(["M3 6h18", "M8 6V4h8v2", "M19 6l-1 14H6L5 6"]);
export const IconFile = make(["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6"]);
export const IconExternal = make(["M15 3h6v6", "M10 14 21 3", "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"]);
export const IconDollar = make(["M12 1v22", "M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"]);
export const IconTarget = make(["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z", "M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"]);
export const IconPause = make(["M6 4h4v16H6z", "M14 4h4v16h-4z"]);
export const IconSkip = make(["m5 4 10 8-10 8z", "M19 5v14"]);
export const IconGrad = make(["M22 10 12 5 2 10l10 5z", "M6 12v5c3 3 9 3 12 0v-5"]);
