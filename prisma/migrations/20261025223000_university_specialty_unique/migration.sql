-- Prevents duplicate program rows for the same university, mode, and admission year.
CREATE UNIQUE INDEX IF NOT EXISTS "UniversitySpecialty_universityName_specialtyName_city_admissionGroup_tuitionType_academicYear_key"
ON "UniversitySpecialty"(
  "universityName",
  "specialtyName",
  "city",
  "admissionGroup",
  "tuitionType",
  "academicYear"
);
