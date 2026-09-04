-- Enforce immutable paid bills and one monthly fixed-rate entitlement.

alter table bill_items
  add column if not exists billing_period_month date;

update bill_items bi
set billing_period_month = date_trunc(
  'month',
  coalesce(b.period_from, b.created_at::date)
)::date
from bills b
where b.id = bi.bill_id
  and b.bill_type = 'visiting'
  and bi.allocation_type = 'fixed'
  and bi.billing_period_month is null;

alter table bill_items
  drop constraint if exists bill_items_billing_period_month_start_check;

alter table bill_items
  add constraint bill_items_billing_period_month_start_check
  check (
    billing_period_month is null
    or billing_period_month = date_trunc('month', billing_period_month)::date
  );

create unique index if not exists uq_bill_items_fixed_allocation_month
  on bill_items (allocation_id, billing_period_month)
  where allocation_type = 'fixed'
    and allocation_id is not null
    and billing_period_month is not null;

create or replace function require_visiting_fixed_billing_month()
returns trigger
language plpgsql
as $$
declare
  parent_bill_type bill_type;
begin
  if new.allocation_type = 'fixed' and new.billing_period_month is null then
    select bill_type into parent_bill_type from bills where id = new.bill_id;
    if parent_bill_type = 'visiting' then
      raise exception 'Visiting fixed bill items require a monthly billing period.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists bill_items_require_visiting_fixed_month on bill_items;
create trigger bill_items_require_visiting_fixed_month
before insert or update on bill_items
for each row
execute function require_visiting_fixed_billing_month();

create or replace function protect_paid_bill_integrity()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'paid' then
    raise exception 'Paid bills are immutable and cannot be changed or deleted.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists bills_protect_paid_update on bills;
create trigger bills_protect_paid_update
before update on bills
for each row
when (old.status = 'paid')
execute function protect_paid_bill_integrity();

drop trigger if exists bills_protect_paid_delete on bills;
create trigger bills_protect_paid_delete
before delete on bills
for each row
when (old.status = 'paid')
execute function protect_paid_bill_integrity();

create or replace function protect_paid_bill_item_integrity()
returns trigger
language plpgsql
as $$
declare
  old_parent_status bill_status;
  new_parent_status bill_status;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select status into old_parent_status from bills where id = old.bill_id;
    if old_parent_status = 'paid' then
      raise exception 'Items belonging to paid bills are immutable.';
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select status into new_parent_status from bills where id = new.bill_id;
    if new_parent_status = 'paid' then
      raise exception 'Items cannot be added or moved to a paid bill.';
    end if;
    return new;
  end if;

  return old;
end;
$$;

drop trigger if exists bill_items_protect_paid_integrity on bill_items;
create trigger bill_items_protect_paid_integrity
before insert or update or delete on bill_items
for each row
execute function protect_paid_bill_item_integrity();

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

drop trigger if exists attendance_records_protect_paid_claim on attendance_records;
create trigger attendance_records_protect_paid_claim
before insert or update or delete on attendance_records
for each row
execute function protect_paid_attendance_claim();