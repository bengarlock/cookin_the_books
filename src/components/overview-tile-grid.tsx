"use client";

import {
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  moveOverviewTile,
  reconcileOverviewTileOrder,
} from "@/lib/overview-tile-order";

const HOLD_DELAY_MS = 2_000;
const ARMING_MOVE_TOLERANCE = 8;
const REFLOW_DURATION_MS = 500;

type OverviewTile = {
  id: string;
  content: ReactNode;
};

type PointerSession = {
  element: HTMLDivElement;
  id: number;
  startX: number;
  startY: number;
  tileId: string;
  grabX: number;
  grabY: number;
  pointerX: number;
  pointerY: number;
};

export function OverviewTileGrid({
  initialOrder,
  items,
  onOrderChange,
}: {
  initialOrder: string[];
  items: OverviewTile[];
  onOrderChange: (order: string[]) => Promise<void>;
}) {
  const itemIds = useMemo(() => items.map((item) => item.id), [items]);
  const itemIdsKey = itemIds.join("\0");
  const itemsById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  );
  const [order, setOrder] = useState(() =>
    reconcileOverviewTileOrder(initialOrder, itemIds),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [armingId, setArmingId] = useState<string | null>(null);
  const [translation, setTranslation] = useState({ x: 0, y: 0 });
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const tileElements = useRef(new Map<string, HTMLDivElement>());
  const holdTimer = useRef<number | null>(null);
  const pointerSession = useRef<PointerSession | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const orderRef = useRef(order);
  const savedOrderRef = useRef(order);
  const translationRef = useRef(translation);
  const previousRects = useRef<Map<string, DOMRect> | null>(null);
  const dragChanged = useRef(false);
  const suppressClick = useRef(false);

  useEffect(() => {
    setOrder((current) => {
      const availableIds = itemIdsKey ? itemIdsKey.split("\0") : [];
      const next = reconcileOverviewTileOrder(current, availableIds);
      orderRef.current = next;
      return next;
    });
  }, [itemIdsKey]);

  useEffect(
    () => () => {
      if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    },
    [],
  );

  useLayoutEffect(() => {
    const prior = previousRects.current;
    if (!prior) return;
    previousRects.current = null;

    tileElements.current.forEach((element, id) => {
      if (id === activeIdRef.current) return;
      const before = prior.get(id);
      if (!before) return;
      const after = element.getBoundingClientRect();
      const deltaX = before.left - after.left;
      const deltaY = before.top - after.top;
      if (!deltaX && !deltaY) return;

      element.animate(
        [
          { transform: `translate3d(${deltaX}px, ${deltaY}px, 0)` },
          { transform: "translate3d(0, 0, 0)" },
        ],
        {
          duration: REFLOW_DURATION_MS,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        },
      );
    });

    const session = pointerSession.current;
    const draggedElement = session
      ? tileElements.current.get(session.tileId)
      : null;
    if (!session || !draggedElement || !activeIdRef.current) return;

    const current = draggedElement.getBoundingClientRect();
    const priorTranslation = translationRef.current;
    const nextTranslation = {
      x:
        session.pointerX -
        session.grabX -
        (current.left - priorTranslation.x),
      y:
        session.pointerY -
        session.grabY -
        (current.top - priorTranslation.y),
    };
    translationRef.current = nextTranslation;
    setTranslation(nextTranslation);
  }, [order]);

  function clearHoldTimer() {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    setArmingId(null);
  }

  function releasePointerCapture(session: PointerSession) {
    if (session.element.hasPointerCapture(session.id)) {
      session.element.releasePointerCapture(session.id);
    }
  }

  function beginPointerSession(
    event: ReactPointerEvent<HTMLDivElement>,
    tileId: string,
  ) {
    if (event.button !== 0 || activeIdRef.current || saveStatus === "saving") {
      return;
    }

    clearHoldTimer();
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    pointerSession.current = {
      element,
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      tileId,
      grabX: event.clientX - rect.left,
      grabY: event.clientY - rect.top,
      pointerX: event.clientX,
      pointerY: event.clientY,
    };
    element.setPointerCapture(event.pointerId);
    setArmingId(tileId);

    holdTimer.current = window.setTimeout(() => {
      const session = pointerSession.current;
      if (!session || session.tileId !== tileId) return;
      holdTimer.current = null;
      activeIdRef.current = tileId;
      suppressClick.current = true;
      dragChanged.current = false;
      setArmingId(null);
      setActiveId(tileId);
    }, HOLD_DELAY_MS);
  }

  function captureCurrentRects() {
    previousRects.current = new Map(
      Array.from(tileElements.current.entries()).map(([id, element]) => [
        id,
        element.getBoundingClientRect(),
      ]),
    );
  }

  function movePointer(event: ReactPointerEvent<HTMLDivElement>) {
    const session = pointerSession.current;
    if (!session || session.id !== event.pointerId) return;
    session.pointerX = event.clientX;
    session.pointerY = event.clientY;

    if (!activeIdRef.current) {
      if (
        Math.hypot(
          event.clientX - session.startX,
          event.clientY - session.startY,
        ) > ARMING_MOVE_TOLERANCE
      ) {
        clearHoldTimer();
        pointerSession.current = null;
        releasePointerCapture(session);
      }
      return;
    }

    event.preventDefault();
    const element = tileElements.current.get(session.tileId);
    if (!element) return;
    const current = element.getBoundingClientRect();
    const priorTranslation = translationRef.current;
    const nextTranslation = {
      x:
        event.clientX -
        session.grabX -
        (current.left - priorTranslation.x),
      y:
        event.clientY -
        session.grabY -
        (current.top - priorTranslation.y),
    };
    translationRef.current = nextTranslation;
    setTranslation(nextTranslation);

    const overElement = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-overview-tile-id]");
    const overId = overElement?.dataset.overviewTileId;
    if (!overId || overId === session.tileId) return;

    const nextOrder = moveOverviewTile(
      orderRef.current,
      session.tileId,
      overId,
    );
    if (nextOrder === orderRef.current) return;
    captureCurrentRects();
    dragChanged.current = true;
    orderRef.current = nextOrder;
    setOrder(nextOrder);
  }

  async function saveOrder(nextOrder: string[]) {
    setSaveStatus("saving");
    try {
      await onOrderChange(nextOrder);
      savedOrderRef.current = nextOrder;
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }

  function finishPointerSession(event: ReactPointerEvent<HTMLDivElement>) {
    const session = pointerSession.current;
    if (!session || session.id !== event.pointerId) return;
    const wasDragging = Boolean(activeIdRef.current);
    clearHoldTimer();
    pointerSession.current = null;
    releasePointerCapture(session);
    activeIdRef.current = null;
    setActiveId(null);
    translationRef.current = { x: 0, y: 0 };
    setTranslation({ x: 0, y: 0 });

    if (wasDragging) {
      event.preventDefault();
      if (
        dragChanged.current &&
        orderRef.current.join("\0") !== savedOrderRef.current.join("\0")
      ) {
        void saveOrder(orderRef.current);
      }
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted">
        <p>Press and hold a tile for 2 seconds, then drag to reposition it.</p>
        <p aria-live="polite">
          {saveStatus === "saving"
            ? "Saving layout…"
            : saveStatus === "saved"
              ? "Layout saved"
              : saveStatus === "error"
                ? "Layout could not be saved"
                : ""}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {order.map((id) => {
          const item = itemsById.get(id);
          if (!item) return null;
          const isActive = activeId === id;
          const isArming = armingId === id;
          return (
            <div
              className={`relative min-w-0 select-none [&>*]:h-full ${
                isActive
                  ? "z-20 cursor-grabbing touch-none"
                  : "cursor-grab touch-pan-y"
              }`}
              data-overview-tile-id={id}
              key={id}
              onClickCapture={(event) => {
                if (suppressClick.current) {
                  event.preventDefault();
                  event.stopPropagation();
                }
              }}
              onContextMenu={(event) => event.preventDefault()}
              onLostPointerCapture={finishPointerSession}
              onPointerCancel={finishPointerSession}
              onPointerDown={(event) => beginPointerSession(event, id)}
              onPointerMove={movePointer}
              onPointerUp={finishPointerSession}
              ref={(element) => {
                if (element) tileElements.current.set(id, element);
                else tileElements.current.delete(id);
              }}
              style={
                isActive
                  ? {
                      pointerEvents: "none",
                      transform: `translate3d(${translation.x}px, ${translation.y}px, 0)`,
                    }
                  : undefined
              }
            >
              <div
                className={`h-full rounded-2xl transition-[filter,opacity,transform,box-shadow] duration-500 [&>*]:h-full ${
                  isActive
                    ? "scale-[1.025] opacity-95 shadow-[0_28px_80px_rgba(0,0,0,0.5)] brightness-110"
                    : isArming
                      ? "animate-pulse ring-2 ring-accent/40"
                      : ""
                }`}
              >
                {item.content}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
