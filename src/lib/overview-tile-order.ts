export function reconcileOverviewTileOrder(
  preferredOrder: string[],
  availableIds: string[],
) {
  const available = new Set(availableIds);
  const seen = new Set<string>();
  const reconciled = preferredOrder.filter((id) => {
    if (!available.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  availableIds.forEach((id) => {
    if (!seen.has(id)) reconciled.push(id);
  });

  return reconciled;
}

export function moveOverviewTile(
  order: string[],
  activeId: string,
  overId: string,
) {
  const fromIndex = order.indexOf(activeId);
  const toIndex = order.indexOf(overId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return order;

  const next = [...order];
  next.splice(fromIndex, 1);
  next.splice(toIndex, 0, activeId);
  return next;
}
