export const MAX_AMAZON_ORDER_EXPORT_BYTES = 100 * 1024 * 1024;

type UploadFile = Pick<File, "name" | "size">;

export function validateAmazonOrderImportFile(file: UploadFile) {
  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith(".zip") && !fileName.endsWith(".csv")) {
    return "Select Amazon's Your Orders ZIP file or Order History.csv.";
  }
  if (file.size > MAX_AMAZON_ORDER_EXPORT_BYTES) {
    return "The Amazon export must be 100 MB or smaller.";
  }
  return null;
}

export function amazonImportErrorMessage(
  data: unknown,
  fallbackMessage: string,
) {
  if (!data || typeof data !== "object") return fallbackMessage;
  for (const key of ["message", "detail", "file"] as const) {
    const value = (data as Record<string, unknown>)[key];
    if (typeof value === "string" && value) return value;
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  }
  return fallbackMessage;
}
