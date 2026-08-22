const budgetPlanPathname = "/dashboard/budget";

export function appRelativePathname(pathname: string, appBasePath: string) {
  return pathname.startsWith(appBasePath)
    ? pathname.slice(appBasePath.length) || "/"
    : pathname;
}

export function budgetPlanNavigationSource({
  appBasePath,
  currentPathname,
  destinationPathname,
}: {
  appBasePath: string;
  currentPathname: string;
  destinationPathname: string;
}) {
  const destination = appRelativePathname(destinationPathname, appBasePath);
  return destination === budgetPlanPathname &&
    currentPathname.startsWith(`${budgetPlanPathname}/`)
    ? currentPathname
    : null;
}

export function isBudgetPlanNavigationPending({
  currentPathname,
  sourcePathname,
}: {
  currentPathname: string;
  sourcePathname: string | null;
}) {
  return (
    currentPathname !== budgetPlanPathname &&
    sourcePathname === currentPathname
  );
}
