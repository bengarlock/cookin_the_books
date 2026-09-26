const EMPTY_SLOT_PREFIX = "__overview-empty-";
const OVERVIEW_GRID_COLUMNS = 4;

export function isOverviewEmptySlot(id: string) {
  return id.startsWith(EMPTY_SLOT_PREFIX);
}

export function overviewOccupiedColumnSpan(order: string[]) {
  return order.reduce(
    (widestSpan, id, index) =>
      isOverviewEmptySlot(id)
        ? widestSpan
        : Math.max(widestSpan, (index % OVERVIEW_GRID_COLUMNS) + 1),
    1,
  );
}

function nextEmptySlotId(usedIds: Set<string>) {
  let index = 0;
  let id = `${EMPTY_SLOT_PREFIX}${index}`;
  while (usedIds.has(id)) {
    index += 1;
    id = `${EMPTY_SLOT_PREFIX}${index}`;
  }
  usedIds.add(id);
  return id;
}

export function reconcileOverviewTileOrder(
  preferredOrder: string[],
  availableIds: string[],
) {
  const available = new Set(availableIds);
  const seen = new Set<string>();
  const reconciled = preferredOrder.filter((id) => {
    if (
      (!available.has(id) && !isOverviewEmptySlot(id)) ||
      seen.has(id)
    ) {
      return false;
    }
    seen.add(id);
    return true;
  });

  availableIds.forEach((id) => {
    if (!seen.has(id)) {
      reconciled.push(id);
      seen.add(id);
    }
  });

  const minimumSlotCount =
    Math.ceil((availableIds.length + 1) / OVERVIEW_GRID_COLUMNS) *
    OVERVIEW_GRID_COLUMNS;
  while (reconciled.length < minimumSlotCount) {
    reconciled.push(nextEmptySlotId(seen));
  }

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
  next[fromIndex] = overId;
  next[toIndex] = activeId;
  return next;
}
