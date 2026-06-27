type ApiErrorPayload = Record<string, unknown> | unknown[] | string | number | boolean | null;

function asRecord(data: ApiErrorPayload): Record<string, unknown> | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  return data as Record<string, unknown>;
}

function firstString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = firstString(item);
      if (candidate) {
        return candidate;
      }
    }
  }

  return null;
}

export function extractApiErrorMessage(
  data: ApiErrorPayload,
  fallback: string,
): string {
  const record = asRecord(data);
  if (!record) {
    return fallback;
  }

  const message = firstString(record.message);
  if (message) {
    return message;
  }

  const detail = firstString(record.detail);
  if (detail) {
    return detail;
  }

  const nonFieldErrors = firstString(record.non_field_errors);
  if (nonFieldErrors) {
    return nonFieldErrors;
  }

  for (const [key, value] of Object.entries(record)) {
    if (key === "created" || key === "created_count") {
      continue;
    }

    const fieldError = firstString(value);
    if (fieldError) {
      return `${key}: ${fieldError}`;
    }
  }

  return fallback;
}

export function extractApiErrorDetail(data: ApiErrorPayload): string | null {
  const record = asRecord(data);
  if (!record) {
    return null;
  }

  const detail = firstString(record.detail);
  if (!detail) {
    return null;
  }

  const message = firstString(record.message);
  if (message && message === detail) {
    return null;
  }

  return detail;
}
