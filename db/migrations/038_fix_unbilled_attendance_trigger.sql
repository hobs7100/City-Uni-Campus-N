-- The paid-attendance guard must pass through ordinary unbilled inserts and
-- updates. Returning OLD from a BEFORE INSERT trigger cancels the insert.
create or replace function protect_paid_attendance_claim()
returns trigger
language plpgsql
as $$
declare
  old_parent_status bill_status;
  new_parent_status bill_status;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.bill_item_id is not null then
    select b.status
    into old_parent_status
    from bill_items bi
    join bills b on b.id = bi.bill_id
    where bi.id = old.bill_item_id;

    if old_parent_status = 'paid' then
      raise exception 'Attendance belonging to a paid bill is immutable.';
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.bill_item_id is not null then
    select b.status
    into new_parent_status
    from bill_items bi
    join bills b on b.id = bi.bill_id
    where bi.id = new.bill_item_id;

    if new_parent_status = 'paid' then
      raise exception 'Attendance cannot be attached or moved to a paid bill.';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;