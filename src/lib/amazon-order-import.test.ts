import { describe, expect, it } from "vitest";

import {
  amazonImportErrorMessage,
  MAX_AMAZON_ORDER_EXPORT_BYTES,
  validateAmazonOrderImportFile,
} from "./amazon-order-import";

describe("Amazon order import validation", () => {
  it("accepts Amazon ZIP exports", () => {
    expect(
      validateAmazonOrderImportFile({
        name: "Your Orders.zip",
        size: 42 * 1024 * 1024,
      }),
    ).toBeNull();
  });

  it("continues to accept the legacy Order History CSV", () => {
    expect(
      validateAmazonOrderImportFile({
        name: "Order History.csv",
        size: 4 * 1024 * 1024,
      }),
    ).toBeNull();
  });

  it("rejects unsupported and oversized exports", () => {
    expect(
      validateAmazonOrderImportFile({
        name: "orders.txt",
        size: 1024,
      }),
    ).toBe("Select Amazon's Your Orders ZIP file or Order History.csv.");
    expect(
      validateAmazonOrderImportFile({
        name: "Your Orders.zip",
        size: MAX_AMAZON_ORDER_EXPORT_BYTES + 1,
      }),
    ).toBe("The Amazon export must be 100 MB or smaller.");
  });

  it("reads field-level backend errors", () => {
    expect(
      amazonImportErrorMessage(
        { file: "The ZIP does not contain Order History.csv." },
        "Import failed.",
      ),
    ).toBe("The ZIP does not contain Order History.csv.");
  });

  it("does not display an HTML proxy error", () => {
    expect(
      amazonImportErrorMessage(
        {
          message:
            "Amazon order import failed. " +
            "<html><head><title>413 Request Entity Too Large</title></head></html>",
        },
        "Amazon order import failed.",
      ),
    ).toBe("Amazon order import failed.");
  });
});
