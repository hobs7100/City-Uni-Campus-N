import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/requireRole";
import { query } from "@/lib/db";
import { z } from "zod";
export async function GET(req:NextRequest){
  const {response}=await requireRole("admin","coordinator");if(response)return response;
  const p=z.object({q:z.string().trim().min(1),limit:z.coerce.number().int().min(1).max(50).default(20)}).safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
  if(!p.success)return NextResponse.json({error:"q is required and limit must be between 1 and 50."},{status:400});
  const q=`%${p.data.q}%`; const students=await query(
    `select s.id,s.name,s.father_name,s.roll_no
     from students s
     join classes cl on cl.id=s.class_id
     where s.deleted_at is null and s.status='active' and cl.type='DIT'
       and (s.name ilike $1 or s.roll_no ilike $1)
     order by s.name limit $2`,
    [q,p.data.limit]
  );
  return NextResponse.json({students});
}