"use server";

import { revalidatePath } from "next/cache";
import { parseSpecialtyCsv, validateDimSourceUrl } from "@/lib/specialty-csv";
import { prisma } from "@/lib/prisma";

// DİM-dən alınmış CSV-ni qaralama kimi idxal edir; qeydlər yalnız ayrıca təsdiqdən sonra görünür.
export async function importSpecialtiesAction(formData: FormData) {
  const sourceValue = formData.get("sourceUrl");
  const file = formData.get("file");
  if (typeof sourceValue !== "string" || !(file instanceof File)) {
    throw new Error("DİM mənbə URL-i və CSV faylı təqdim edilməlidir.");
  }
  const sourceUrl = validateDimSourceUrl(sourceValue);
  if (file.size === 0 || file.size > 2_000_000) {
    throw new Error("CSV faylı boş ola bilməz və 2 MB-dan böyük olmamalıdır.");
  }
  const csv = await file.text();
  const rows = parseSpecialtyCsv(csv);
  const years = [...new Set(rows.map((row) => row.academicYear))];
  const existing = await prisma.universitySpecialty.findMany({
    where: { academicYear: { in: years } },
    select: {
      universityName: true,
      specialtyName: true,
      city: true,
      admissionGroup: true,
      tuitionType: true,
      academicYear: true
    }
  });
  const existingKeys = new Set(
    existing.map((row) =>
      [
        row.universityName,
        row.specialtyName,
        row.city,
        row.admissionGroup,
        row.tuitionType,
        row.academicYear
      ].join("\u0000")
    )
  );
  const uniqueRows = rows.filter((row) => {
    const key = [
      row.universityName,
      row.specialtyName,
      row.city,
      row.admissionGroup,
      row.tuitionType,
      row.academicYear
    ].join("\u0000");
    if (existingKeys.has(key)) return false;
    existingKeys.add(key);
    return true;
  });
  const duplicates = rows.length - uniqueRows.length;
  const batches = [];
  for (let index = 0; index < uniqueRows.length; index += 50) {
    batches.push(
      prisma.universitySpecialty.createMany({
        data: uniqueRows.slice(index, index + 50).map((row) => ({
          ...row,
          admissionSubgroup: row.admissionSubgroup || null,
          sourceUrl,
          published: false
        }))
      })
    );
  }
  const inserted = batches.length > 0 ? await prisma.$transaction(batches) : [];
  const imported = inserted.reduce((total, batch) => total + batch.count, 0);

  await prisma.jobLog.create({
    data: {
      jobName: "dim-specialty-import",
      status: "SUCCESS",
      message: `${imported} ixtisas yoxlanış növbəsinə əlavə edildi; ${duplicates} təkrar sətir ötürüldü. Mənbə: ${sourceUrl}`
    }
  });
  revalidatePath("/admin");
  revalidatePath("/universitet-ixtisas");
}

// Yalnız inzibatçı yoxlamasından keçən ixtisas qeydini ictimai kataloqa çıxarır.
export async function publishSpecialtyAction(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) throw new Error("İxtisas qeydi düzgün deyil.");

  await prisma.$transaction(async (transaction) => {
    const record = await transaction.universitySpecialty.findUnique({ where: { id } });
    if (!record || record.published) throw new Error("Qeyd tapılmadı və ya artıq dərc edilib.");
    validateDimSourceUrl(record.sourceUrl);
    await transaction.universitySpecialty.update({
      where: { id },
      data: { published: true }
    });
    await transaction.jobLog.create({
      data: {
        jobName: "dim-specialty-review",
        status: "SUCCESS",
        message: `${record.specialtyName} (${record.universityName}), ${record.academicYear} qəbul ili, DİM mənbəsi ilə yoxlanıb dərc edildi.`
      }
    });
  });
  revalidatePath("/admin");
  revalidatePath("/universitet-ixtisas");
  revalidatePath("/bal-hesabla");
  revalidatePath("/sitemap.xml");
}

// İdxal növbəsindəki məlumatı ictimai yayımdan əvvəl rədd edir.
export async function rejectSpecialtyAction(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) throw new Error("İxtisas qeydi düzgün deyil.");
  const result = await prisma.universitySpecialty.deleteMany({ where: { id, published: false } });
  if (result.count !== 1) throw new Error("Qeyd tapılmadı və ya artıq nəzərdən keçirilib.");
  revalidatePath("/admin");
}
