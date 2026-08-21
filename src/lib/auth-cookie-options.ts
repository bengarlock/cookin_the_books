type AuthCookieEnvironment = {
  AUTH_COOKIE_DOMAIN?: string;
  AUTH_COOKIE_SECURE?: string;
  NODE_ENV?: string;
};

export function getAuthCookieScope(
  environment: AuthCookieEnvironment = process.env,
) {
  const secure =
    environment.AUTH_COOKIE_SECURE === undefined
      ? environment.NODE_ENV === "production"
      : environment.AUTH_COOKIE_SECURE === "true";
  const configuredDomain = environment.AUTH_COOKIE_DOMAIN;
  const domain =
    configuredDomain === undefined
      ? environment.NODE_ENV === "production"
        ? ".bengarlock.com"
        : undefined
      : configuredDomain.trim() || undefined;

  return {
    secure,
    ...(domain ? { domain } : {}),
  };
}
