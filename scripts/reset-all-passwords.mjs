// Explicit one-time operation. Never run from startup, migrations or publishing.
// Existing sessions are revoked; account status, roles and academic data stay intact.
import bcrypt from "bcryptjs";
import { pool } from "../lib/db.ts";

if (!process.argv.includes("--confirm-reset-all")) {
  console.error("This replaces every account password and ends existing sessions. Run with --confirm-reset-all only when authorized.");
  process.exit(1);
}

const client = await pool.connect();
try {
  const staffHash = await bcrypt.hash("City1234*", 10);
  const studentHash = await bcrypt.hash("City123*", 10);
  await client.query("begin");
  const results = [];
  for (const table of ["users", "teachers", "students"]) {
    const hash = table === "students" ? studentHash : staffHash;
    const result = await client.query(
      `update ${table} set password_hash = $1, must_change_password = true,
         password_version = password_version + 1, updated_at = now()`,
      [hash],
    );
    const verified = await client.query(
      `select count(*)::int as total,
         count(*) filter (where password_hash = $1 and must_change_password = true)::int as verified
       from ${table}`,
      [hash],
    );
    if (verified.rows[0].total !== verified.rows[0].verified) {
      throw new Error(`Verification failed for ${table}; rolling back.`);
    }
    results.push({ account_type: table, reset: result.rowCount, verified: verified.rows[0].verified });
  }
  await client.query("commit");
  console.log("All account passwords reset and verified. First-login password setup is required.");
  console.table(results);
} catch (error) {
  await client.query("rollback");
  console.error(error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
