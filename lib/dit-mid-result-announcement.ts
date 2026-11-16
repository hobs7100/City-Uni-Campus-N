import type { PoolClient } from "pg";

// Reused for student marks, chart data, and both filter-option queries.
// Callers must join dit_test_series with the alias "ts".
export const DIT_STUDENT_RESULT_VISIBILITY =
  "(lower(btrim(ts.name)) <> 'mid-term' or ts.mid_result_announced_at is not null)";

export class MidResultAnnouncementError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** One atomic update, safe for concurrent/repeated announcements. Caller owns any transaction. */
export async function announceDitMidResult(
  client: Pick<PoolClient, "query">, seriesId: string, adminId: string,
) {
  const result = await client.query<{
    id: string; mid_result_announced_at: Date; mid_result_announced_by: string | null;
  }>(
    `update dit_test_series
     set mid_result_announced_at = coalesce(mid_result_announced_at, now()),
         mid_result_announced_by = case when mid_result_announced_at is null
           then $2::uuid else mid_result_announced_by end
     where id = $1::uuid and lower(btrim(name)) = 'mid-term'
     returning id, mid_result_announced_at, mid_result_announced_by`,
    [seriesId, adminId],
  );
  if (result.rows[0]) return result.rows[0];
  const exists = await client.query("select id from dit_test_series where id = $1::uuid", [seriesId]);
  throw new MidResultAnnouncementError(
    exists.rowCount ? "Only the Mid-Term test series can be announced here." : "Test series not found.",
    exists.rowCount ? 400 : 404,
  );
}
