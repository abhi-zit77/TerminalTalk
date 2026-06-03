export interface RuntimeConfig {
  convexUrl?: string | undefined;
  demoMode: boolean;
}

export function loadRuntimeConfig(): RuntimeConfig {
  const convexUrl = process.env["TERMINALTALK_CONVEX_URL"]?.trim();
  const demoMode =
    process.env["TERMINALTALK_DEMO_MODE"]?.trim().toLowerCase() === "true";

  return {
    convexUrl: convexUrl && convexUrl.length > 0 ? convexUrl : undefined,
    demoMode
  };
}
