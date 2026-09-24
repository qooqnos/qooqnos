export type SeoActivationState = "configured" | "partial" | "unconfigured";

export interface SeoActivation {
  readonly state: SeoActivationState;
  readonly ready: boolean;
  readonly reasons: readonly string[];
}

export function activation(present: boolean, ready: boolean, reasons: readonly string[] = []): SeoActivation {
  const state: SeoActivationState = ready ? "configured" : present ? "partial" : "unconfigured";
  return { state, ready, reasons };
}

export function canonicalActivation(value: string): SeoActivation {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname) {
      return activation(true, false, ["Canonical SEO base URL must use HTTPS and include a hostname."]);
    }
    return activation(true, true);
  } catch {
    return activation(true, false, ["Canonical SEO base URL is not a valid URL."]);
  }
}
