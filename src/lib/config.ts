function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export const APP_BASE_PATH = "/cookinthebooks";

export class PortfolioApiConfigurationError extends Error {
  constructor() {
    super(
      "Set PORTFOLIO_API_BASE_URL or NEXT_PUBLIC_API_BASE_URL before starting the app.",
    );
    this.name = "PortfolioApiConfigurationError";
  }
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

export function appPath(pathname: string) {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${APP_BASE_PATH}${normalizedPath}`;
}
