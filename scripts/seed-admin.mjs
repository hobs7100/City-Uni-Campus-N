import pg from "pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("SUPABASE_DB_URL is not set.");
  process.exit(1);
}

const email = process.env.SEED_ADMIN_EMAIL || "admin@citycollege.edu.pk";
const password = process.env.SEED_ADMIN_PASSWORD || "Admin@12345";

const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    const existing = await client.query("select id from users where email = $1", [email]);
    if (existing.rows.length > 0) {
      console.log(`Admin user already exists: ${email}`);
      return;
    }
    const hash = await bcrypt.hash(password, 10);
    await client.query(
      `insert into users (name, email, password_hash, role, status)
       values ($1, $2, $3, 'admin', 'active')`,
      ["System Administrator", email, hash]
    );
    console.log(`Seeded admin user: ${email} / ${password}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
