import { describe, expect, it } from "vitest";

import { calendarDragPreviewPosition } from "./calendar-drag-feedback";

describe("calendar drag preview", () => {
  it("follows the pointer with a gap", () => {
    expect(calendarDragPreviewPosition(100, 200, 1280, 720)).toEqual({
      left: 116, top: 216, width: 240, height: 96,
    });
    expect(calendarDragPreviewPosition(150, 250, 1280, 720)).toMatchObject({
      left: 166, top: 266,
    });
  });

  it("keeps the preview inside narrow and bottom-edge viewports", () => {
    const position = calendarDragPreviewPosition(375, 700, 390, 720);
    expect(position.left + position.width).toBeLessThanOrEqual(382);
    expect(position.top + position.height).toBeLessThan(700);
    expect(calendarDragPreviewPosition(190, 50, 200, 400)).toMatchObject({
      left: 8, width: 184,
    });
  });

  it("positions touch previews above the finger without leaving the top edge", () => {
    expect(calendarDragPreviewPosition(200, 400, 390, 800, "touch").top).toBe(288);
    expect(calendarDragPreviewPosition(10, 20, 390, 800, "touch").top).toBe(8);
  });
});
