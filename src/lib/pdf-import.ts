export const MAX_PDF_IMPORT_FILES = 100;
export const MAX_PDF_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_BATCH_BYTES = 30 * 1024 * 1024;

export const PDF_BATCH_TOO_LARGE_MESSAGE =
  "The selected PDFs are too large to upload together. The combined size must be 30 MB or smaller.";
export const MAX_CSV_FILE_BYTES = 2 * 1024 * 1024;

type UploadFile = Pick<File, "name" | "size" | "type">;

export function validatePdfImportFiles(files: UploadFile[]) {
  if (files.length > MAX_PDF_IMPORT_FILES) {
    return `Select no more than ${MAX_PDF_IMPORT_FILES} PDFs at a time.`;
  }

  const oversizedFile = files.find((file) => file.size > MAX_PDF_FILE_BYTES);
  if (oversizedFile) {
    return `${oversizedFile.name} is larger than the 10 MB per-file limit.`;
  }

  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  if (totalBytes > MAX_PDF_BATCH_BYTES) {
    return PDF_BATCH_TOO_LARGE_MESSAGE;
  }

  return null;
}

export function validateCreditCardImportFiles(files: UploadFile[]) {
  const validationError = validatePdfImportFiles(files);
  if (validationError) {
    return validationError.replaceAll("PDFs", "files").replaceAll("PDF", "file");
  }

  const invalidFile = files.find((file) => {
    const fileName = file.name.toLowerCase();
    const isPdf = file.type === "application/pdf" || fileName.endsWith(".pdf");
    const isCsv =
      file.type === "text/csv" ||
      file.type === "application/csv" ||
      fileName.endsWith(".csv");
    return !isPdf && !isCsv;
  });
  if (invalidFile) {
    return `${invalidFile.name} must be a PDF or CSV file.`;
  }

  const oversizedCsv = files.find(
    (file) =>
      file.name.toLowerCase().endsWith(".csv") &&
      file.size > MAX_CSV_FILE_BYTES,
  );
  if (oversizedCsv) {
    return `${oversizedCsv.name} is larger than the 2 MB CSV limit.`;
  }

  return null;
}

export async function readImportResponse(
  response: Response,
  fallbackMessage: string,
) {
  const data = await response.json().catch(() => null);
  if (data && typeof data === "object") {
    return data;
  }

  if (response.status === 413) {
    return { detail: PDF_BATCH_TOO_LARGE_MESSAGE };
  }

  return { message: fallbackMessage };
}

export const readPdfImportResponse = readImportResponse;
