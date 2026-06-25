export const AUTH_INVALIDATED_HEADER = "x-cookin-auth-invalid";

export function isBackendInvalidTokenResponse(status: number) {
  return status === 401;
}
