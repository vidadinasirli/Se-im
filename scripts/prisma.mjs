import { spawnSync } from "node:child_process";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const sourceSchemaPath = resolve(root, "prisma", "schema.prisma");
const postgresSchemaPath = resolve(root, "prisma", "postgresql", "schema.prisma");
const postgresMigrationsPath = resolve(root, "prisma", "postgresql", "migrations");
const prismaCliPath = resolve(root, "node_modules", "prisma", "build", "index.js");
const databaseUrl = process.env.DATABASE_URL ?? "";
const provider =
  process.env.DATABASE_PROVIDER ??
  (databaseUrl.startsWith("postgresql://") || databaseUrl.startsWith("postgres://")
    ? "postgresql"
    : "sqlite");

if (provider !== "sqlite" && provider !== "postgresql") {
  throw new Error("DATABASE_PROVIDER 'sqlite' və ya 'postgresql' olmalıdır.");
}
if (
  (provider === "sqlite" && !databaseUrl.startsWith("file:")) ||
  (provider === "postgresql" &&
    !databaseUrl.startsWith("postgresql://") &&
    !databaseUrl.startsWith("postgres://"))
) {
  throw new Error(`DATABASE_URL DATABASE_PROVIDER=${provider} dəyəri ilə uyğun deyil.`);
}

const args = process.argv.slice(2);
if (args.length === 0) throw new Error("Prisma əmri göstərilməyib.");

let schemaPath = sourceSchemaPath;
if (provider === "postgresql") {
  const schema = await readFile(sourceSchemaPath, "utf8");
  const postgresSchema = schema.replace(
    'provider = "sqlite"',
    'provider = "postgresql"'
  );
  if (postgresSchema === schema) {
    throw new Error("Prisma sxemində SQLite provider sətri tapılmadı.");
  }
  await mkdir(resolve(root, "prisma", "postgresql"), { recursive: true });
  await writeFile(postgresSchemaPath, postgresSchema, "utf8");
  schemaPath = postgresSchemaPath;
}

try {
  if (args[0] === "baseline") {
    if (provider !== "postgresql") {
      throw new Error("İstehsal bazasının ilkin miqrasiyası üçün DATABASE_PROVIDER=postgresql seçin.");
    }
    const migrationName = "20261025223500_initial";
    const migrationDirectory = resolve(postgresMigrationsPath, migrationName);
    try {
      await readFile(resolve(migrationDirectory, "migration.sql"), "utf8");
      throw new Error("İlkin PostgreSQL miqrasiyası artıq var; mövcud faylı dəyişdirməyin.");
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
        throw error;
      }
    }
    await mkdir(migrationDirectory, { recursive: true });
    const result = spawnSync(
      process.execPath,
      [
        prismaCliPath,
        "migrate",
        "diff",
        "--from-empty",
        "--to-schema-datamodel",
        schemaPath,
        "--script"
      ],
      { cwd: root, encoding: "utf8", env: process.env }
    );
    if (result.status !== 0) {
      process.stderr.write(result.stderr ?? "");
      throw new Error("PostgreSQL ilkin miqrasiyası yaradılmadı.");
    }
    await writeFile(resolve(migrationDirectory, "migration.sql"), result.stdout, "utf8");
    await writeFile(
      resolve(postgresMigrationsPath, "migration_lock.toml"),
      'provider = "postgresql"\n',
      "utf8"
    );
    console.log(`İlkin sxem yaradıldı: prisma/postgresql/migrations/${migrationName}`);
  } else {
    const result = spawnSync(
      process.execPath,
      [prismaCliPath, ...args, "--schema", schemaPath],
      { cwd: root, stdio: "inherit", env: process.env }
    );
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  }
} finally {
  if (provider === "postgresql") {
    await unlink(postgresSchemaPath).catch(() => undefined);
  }
}
