import type { PoolClient } from "pg";

export async function allocateDitRollNumber(
  client: PoolClient,
  classId: string,
  session: string,
): Promise<string | null> {
  void session;
  const result = await client.query<{ class_name: string; type: string; session: string }>(
    `select class_name, type::text, session from classes where id = $1`,
    [classId],
  );
  const cls = result.rows[0];
  if (!cls || cls.type !== "DIT") return null;
  const normalized = cls.class_name.toLowerCase();
  const section = normalized.includes("digital leaders")
    ? "A"
    : normalized.includes("digital innovators") ? "B" : null;
  // The class record is authoritative; the request value is only used to
  // select the class and must not be able to create a mismatched cohort roll.
  const year = cls.session.match(/(?:^|[^0-9])([0-9]{4})(?![0-9])/);
  if (!section || !year) return null;
  const prefix = `UCDIT-${year[1].slice(-2)}${section}`;
  await client.query(
    `insert into dit_roll_sequences(prefix, next_value) values ($1, 1)
     on conflict (prefix) do nothing`,
    [prefix],
  );
  const seq = await client.query<{ next_value: number }>(
    `select next_value from dit_roll_sequences where prefix = $1 for update`,
    [prefix],
  );
  const value = Number(seq.rows[0].next_value);
  await client.query(`update dit_roll_sequences set next_value = $2 where prefix = $1`, [prefix, value + 1]);
  return `${prefix}-${String(value).padStart(4, "0")}`;
}