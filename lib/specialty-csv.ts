import { z } from "zod";

const headers = [
  "universityName",
  "specialtyName",
  "city",
  "admissionGroup",
  "admissionSubgroup",
  "tuitionType",
  "minimumAdmissionScore",
  "annualTuition",
  "academicYear"
] as const;

const rowSchema = z.object({
  universityName: z.string().trim().min(2).max(240),
  specialtyName: z.string().trim().min(2).max(240),
  city: z.string().trim().min(2).max(120),
  admissionGroup: z.enum(["I", "II", "III", "IV", "V"]),
  admissionSubgroup: z.string().trim().max(80),
  tuitionType: z.enum(["FREE", "PAID"]),
  minimumAdmissionScore: z.number().min(0).max(700).nullable(),
  annualTuition: z.number().int().min(0).max(100_000).nullable(),
  academicYear: z.number().int().min(2000).max(2100)
});

export type ImportedSpecialty = z.infer<typeof rowSchema>;

// Validates a bounded official DİM CSV before records enter the unpublished review queue.
export function parseSpecialtyCsv(csv: string) {
  if (csv.length > 2_000_000) throw new Error("CSV faylı 2 MB-dan böyük ola bilməz.");
  const rows = parseCsvRows(csv.replace(/^\uFEFF/, ""));
  if (rows.length < 2) throw new Error("CSV başlığı və ən azı bir məlumat sətri olmalıdır.");
  if (rows.length > 501) throw new Error("Bir idxalda ən çox 500 ixtisas sətrinə icazə verilir.");

  const actualHeaders = rows[0].map((item) => item.trim());
  if (
    actualHeaders.length !== headers.length ||
    headers.some((header, index) => actualHeaders[index] !== header)
  ) {
    throw new Error(`CSV başlıqları bu ardıcıllıqla olmalıdır: ${headers.join(",")}`);
  }

  const result: ImportedSpecialty[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const [index, cells] of rows.slice(1).entries()) {
    if (cells.every((cell) => cell.trim() === "")) continue;
    if (cells.length !== headers.length) {
      errors.push(`${index + 2}-ci sətir: sütunların sayı düzgün deyil.`);
      continue;
    }
    const values = Object.fromEntries(headers.map((header, i) => [header, cells[i].trim()]));
    const parsed = rowSchema.safeParse({
      ...values,
      admissionSubgroup: values.admissionSubgroup,
      minimumAdmissionScore: parseOptionalNumber(values.minimumAdmissionScore),
      annualTuition: parseOptionalNumber(values.annualTuition),
      academicYear: Number(values.academicYear)
    });
    if (!parsed.success) {
      errors.push(`${index + 2}-ci sətir: ${parsed.error.issues[0]?.message ?? "dəyər düzgün deyil."}`);
      continue;
    }
    const rowKey = [
      parsed.data.universityName,
      parsed.data.specialtyName,
      parsed.data.city,
      parsed.data.admissionGroup,
      parsed.data.tuitionType,
      parsed.data.academicYear
    ].join("\u0000");
    if (seen.has(rowKey)) {
      errors.push(`${index + 2}-ci sətir: eyni ixtisas CSV-də təkrar göstərilib.`);
      continue;
    }
    seen.add(rowKey);
    result.push(parsed.data);
  }
  if (errors.length > 0) {
    throw new Error(`CSV yoxlamasından keçmədi: ${errors.slice(0, 12).join(" ")}${errors.length > 12 ? ` Daha ${errors.length - 12} xəta var.` : ""}`);
  }
  if (result.length === 0) throw new Error("CSV-də idxal edilə bilən sətir yoxdur.");
  return result;
}

export function validateDimSourceUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("DİM mənbə URL-i düzgün deyil.");
  }
  if (
    url.protocol !== "https:" ||
    (url.port && url.port !== "443") ||
    url.username ||
    url.password ||
    !(url.hostname === "dim.gov.az" || url.hostname.endsWith(".dim.gov.az"))
  ) {
    throw new Error("Mənbə URL-i HTTPS üzərindən dim.gov.az domenində olmalıdır.");
  }
  return url.toString();
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseCsvRows(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let afterQuote = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
        afterQuote = true;
      } else {
        cell += character;
      }
    } else if (afterQuote && character === ",") {
      row.push(cell);
      cell = "";
      afterQuote = false;
    } else if (afterQuote && (character === "\n" || character === "\r")) {
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      afterQuote = false;
    } else if (afterQuote && character !== " " && character !== "\t") {
      throw new Error("CSV-də dırnaqdan sonra gözlənilməz simvol var.");
    } else if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      afterQuote = false;
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error("CSV-də bağlanmamış dırnaq var.");
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
