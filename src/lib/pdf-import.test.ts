import { describe, expect, it } from "vitest";

import {
  MAX_CSV_FILE_BYTES,
  MAX_PDF_BATCH_BYTES,
  MAX_PDF_FILE_BYTES,
  PDF_BATCH_TOO_LARGE_MESSAGE,
  readPdfImportResponse,
  validateCreditCardImportFiles,
  validatePdfImportFiles,
} from "./pdf-import";

function upload(name: string, size: number) {
  return { name, size, type: "application/pdf" };
}

describe("PDF import validation", () => {
  it("rejects a file over the per-file limit", () => {
    expect(
      validatePdfImportFiles([
        upload("large.pdf", MAX_PDF_FILE_BYTES + 1),
      ]),
    ).toBe("large.pdf is larger than the 10 MB per-file limit.");
  });

  it("rejects a batch over the combined limit", () => {
    expect(
      validatePdfImportFiles([
        upload("one.pdf", MAX_PDF_BATCH_BYTES / 4 + 1),
        upload("two.pdf", MAX_PDF_BATCH_BYTES / 4),
        upload("three.pdf", MAX_PDF_BATCH_BYTES / 4),
        upload("four.pdf", MAX_PDF_BATCH_BYTES / 4),
      ]),
    ).toBe(PDF_BATCH_TOO_LARGE_MESSAGE);
  });

  it("converts a non-JSON 413 proxy response into a useful error", async () => {
    const response = new Response("<html>Payload Too Large</html>", {
      status: 413,
      headers: { "Content-Type": "text/html" },
    });

    await expect(
      readPdfImportResponse(response, "The import failed."),
    ).resolves.toEqual({ detail: PDF_BATCH_TOO_LARGE_MESSAGE });
  });
});

describe("credit-card import validation", () => {
  it("accepts CSV exports alongside PDF statements", () => {
    expect(
      validateCreditCardImportFiles([
        { name: "since-jun-03.csv", size: 1024, type: "text/csv" },
      ]),
    ).toBeNull();
  });

  it("rejects unsupported file types", () => {
    expect(
      validateCreditCardImportFiles([
        { name: "transactions.txt", size: 1024, type: "text/plain" },
      ]),
    ).toBe("transactions.txt must be a PDF or CSV file.");
  });

  it("rejects CSV files over the CSV size limit", () => {
    expect(
      validateCreditCardImportFiles([
        {
          name: "large.csv",
          size: MAX_CSV_FILE_BYTES + 1,
          type: "text/csv",
        },
      ]),
    ).toBe("large.csv is larger than the 2 MB CSV limit.");
  });
});
