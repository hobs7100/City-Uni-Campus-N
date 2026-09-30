import { readdirSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "db", "migrations");
const args = process.argv.slice(2);
const onlyFiles = args[0] === "--only" ? args.slice(1) : null;
if (args.length && (!onlyFiles?.length || onlyFiles.some((file) => !/^[^/\\]+\.sql$/.test(file)))) {
  console.error("Usage: node scripts/migrate.mjs [--only migration.sql ...]");
  process.exit(1);
}

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("SUPABASE_DB_URL is not set.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    await client.query(`
      create table if not exists schema_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      );
    `);

    const applied = new Set(
      (await client.query("select name from schema_migrations")).rows.map((r) => r.name)
    );

    const available = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
    const files = onlyFiles
      ? [...new Set(onlyFiles)].sort()
      : available.sort();
    const unknown = files.filter((file) => !available.includes(file));
    if (unknown.length) {
      throw new Error(`Unknown migrations: ${unknown.join(", ")}`);
    }

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`Skipping already applied migration: ${file}`);
        continue;
      }
      const sql = readFileSync(join(migrationsDir, file), "utf-8");
      console.log(`Applying migration: ${file}`);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into schema_migrations (name) values ($1)", [file]);
        await client.query("commit");
        console.log(`Applied: ${file}`);
      } catch (err) {
        await client.query("rollback");
        console.error(`Failed to apply ${file}:`, err.message);
        throw err;
      }
    }
    console.log("All migrations applied successfully.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
