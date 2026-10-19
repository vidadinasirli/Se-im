import { Prisma } from "@prisma/client";

// Prisma JSON sahələri üçün kök səviyyəsindəki null dəyərini xüsusi null kimi təqdim edir.
export function toInputJsonValue(value: Prisma.JsonValue | Prisma.InputJsonValue) {
  return value === null ? Prisma.JsonNull : value;
}

// JSON obyektlərinin açar sırasından asılı olmayan müqayisə mətnini yaradır.
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
