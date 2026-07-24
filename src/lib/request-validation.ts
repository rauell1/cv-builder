import { z } from "zod";

export const sessionIdSchema = z.string().trim().min(10).max(128);

export function cleanPlainText(value: string): string {
  return value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim();
}

export function parseOptionalSessionId(value: unknown): string | undefined {
  const result = sessionIdSchema.safeParse(value);
  return result.success ? result.data : undefined;
}
