export function loginDestination(nextPath: string | null) {
  if (!nextPath) return "/dashboard";
  const pathname = nextPath.split(/[?#]/, 1)[0];
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/")
    ? nextPath
    : "/dashboard";
}
