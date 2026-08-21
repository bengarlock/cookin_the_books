import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
const mode = process.argv[2];

if (!new Set(["development", "production"]).has(mode)) {
  throw new Error("Usage: validate-backend-target.mjs development|production");
}

loadEnvConfig(process.cwd(), mode === "development");

const apiUrl = process.env.PORTFOLIO_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL;
const websocketUrl = process.env.PORTFOLIO_WEBSOCKET_BASE_URL;
const allowInsecureApiBaseUrl = process.env.ALLOW_INSECURE_API_BASE_URL === "true";

if (!apiUrl) {
  throw new Error("PORTFOLIO_API_BASE_URL must be configured.");
}

function parsedUrl(label, value) {
  try {
    return new URL(value);
  } catch {
    throw new Error(`${label} must be a valid absolute URL.`);
  }
}

function isLoopback(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

const api = parsedUrl("PORTFOLIO_API_BASE_URL", apiUrl);
const websocket = websocketUrl
  ? parsedUrl("PORTFOLIO_WEBSOCKET_BASE_URL", websocketUrl)
  : null;

if (mode === "development") {
  if (!isLoopback(api.hostname)) {
    throw new Error(`Local development must use a loopback backend, not ${api.origin}.`);
  }
  if (websocket && !isLoopback(websocket.hostname)) {
    throw new Error(`Local development must use a loopback WebSocket backend, not ${websocket.origin}.`);
  }
} else {
  if (isLoopback(api.hostname)) {
    throw new Error("Production cannot start with a loopback API backend.");
  }
  if (api.protocol !== "https:" && !allowInsecureApiBaseUrl) {
    throw new Error(
      "Production must use an HTTPS API backend unless ALLOW_INSECURE_API_BASE_URL=true is explicitly configured for staging.",
    );
  }
  if (websocket && websocket.protocol !== "wss:" && !allowInsecureApiBaseUrl) {
    throw new Error("Production must use a secure WSS WebSocket backend.");
  }
}

console.log(`Backend target validated for ${mode}: ${api.origin}`);
