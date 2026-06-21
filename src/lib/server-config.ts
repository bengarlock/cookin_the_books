import "server-only";

export class PortfolioApiConfigurationError extends Error {
  constructor() {
    super(
      "Set PORTFOLIO_API_BASE_URL or NEXT_PUBLIC_API_BASE_URL before starting the app.",
    );
    this.name = "PortfolioApiConfigurationError";
  }
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getPortfolioApiBaseUrl() {
  const configuredUrl =
    process.env.PORTFOLIO_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!configuredUrl) {
    throw new PortfolioApiConfigurationError();
  }

  return trimTrailingSlash(configuredUrl);
}

export function getPortfolioWebSocketBaseUrl() {
  const configuredUrl = process.env.PORTFOLIO_WEBSOCKET_BASE_URL;
  if (configuredUrl) {
    return trimTrailingSlash(configuredUrl);
  }

  const apiUrl = new URL(getPortfolioApiBaseUrl());
  apiUrl.protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
  return trimTrailingSlash(apiUrl.origin);
}
