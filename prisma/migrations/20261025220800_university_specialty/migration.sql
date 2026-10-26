CREATE TABLE IF NOT EXISTS "UniversitySpecialty" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "universityName" TEXT NOT NULL,
  "specialtyName" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "admissionGroup" TEXT NOT NULL,
  "admissionSubgroup" TEXT,
  "tuitionType" TEXT NOT NULL,
  "minimumAdmissionScore" REAL,
  "annualTuition" INTEGER,
  "academicYear" INTEGER NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "UniversitySpecialty_published_academicYear_idx"
ON "UniversitySpecialty"("published", "academicYear");

CREATE INDEX IF NOT EXISTS "UniversitySpecialty_city_admissionGroup_tuitionType_idx"
ON "UniversitySpecialty"("city", "admissionGroup", "tuitionType");

CREATE INDEX IF NOT EXISTS "UniversitySpecialty_universityName_specialtyName_idx"
ON "UniversitySpecialty"("universityName", "specialtyName");
