declare global {
  interface Window {
    __CLOU_CONFIG__?: {
      apiUrl?: string;
      defaultSelectedSpecs?: string;
    };
  }
}

function parseCommaSeparated(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const defaultSelectedSpecsRaw =
  window.__CLOU_CONFIG__?.defaultSelectedSpecs ??
  import.meta.env.VITE_DEFAULT_SELECTED_SPECS ??
  "Machinery,MachineTool,Core";

export const runtimeConfig = {
  apiUrl:
    window.__CLOU_CONFIG__?.apiUrl ??
    import.meta.env.VITE_API_URL ??
    "http://localhost:8000",

  defaultSelectedSpecs: parseCommaSeparated(defaultSelectedSpecsRaw),
};