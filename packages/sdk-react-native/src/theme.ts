/** Theming tokens. Defaults to the HealthPay brand; override via the `theme` prop. */

export interface HealthPayTheme {
  /** Primary brand surface (headers, dark buttons). */
  navy: string;
  /** Accent / call-to-action. */
  teal: string;
  tealDark: string;
  tealSoft: string;
  /** Alternative-offer accent. */
  gold: string;
  goldSoft: string;
  /** Page background. */
  background: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  onPrimary: string;
  /** Strikethrough / list-price colour. */
  strike: string;
  radius: number;
  radiusLg: number;
}

export const defaultTheme: HealthPayTheme = {
  navy: "#0B1F3F",
  teal: "#14B8A6",
  tealDark: "#0f9488",
  tealSoft: "#effcf9",
  gold: "#D4A24E",
  goldSoft: "#faf3e6",
  background: "#eef2f8",
  surface: "#ffffff",
  border: "#e2e8f2",
  text: "#0B1F3F",
  textMuted: "#5b6b86",
  onPrimary: "#ffffff",
  strike: "#9aa7bd",
  radius: 12,
  radiusLg: 16,
};

export function resolveTheme(overrides?: Partial<HealthPayTheme>): HealthPayTheme {
  return { ...defaultTheme, ...overrides };
}
