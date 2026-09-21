-- DIT roll numbers are scoped by cohort/section; legacy roll numbers remain
-- untouched and are intentionally excluded from this constraint.
create table if not exists dit_roll_sequences (
  prefix varchar(10) primary key,
  next_value integer not null check (next_value > 0)
);

create unique index if not exists idx_students_generated_dit_roll
  on students (roll_no)
  where roll_no ~ '^UCDIT-[0-9]{2}[AB]-[0-9]{4}$';

do $$
declare
  st record;
  roll_prefix text;
  n integer;
begin
  -- Existing generated values reserve their numbers before backfill.
  for roll_prefix in
    select distinct substring(roll_no from '^UCDIT-[0-9]{2}[AB]')
    from students where roll_no ~ '^UCDIT-[0-9]{2}[AB]-[0-9]{4}$'
  loop
    select coalesce(max(substring(roll_no from '([0-9]{4})$')::integer), 0) + 1
      into n from students where roll_no like roll_prefix || '-%';
    insert into dit_roll_sequences(prefix, next_value) values (roll_prefix, n)
      on conflict (prefix) do update
        set next_value = greatest(dit_roll_sequences.next_value, excluded.next_value);
  end loop;

  for st in
    select s.id, c.session, c.class_name
    from students s join classes c on c.id = s.class_id
    where s.deleted_at is null
      and (s.roll_no is null or btrim(s.roll_no) = '')
      and c.type = 'DIT'
      and (lower(c.class_name) like '%digital leaders%'
           or lower(c.class_name) like '%digital innovators%')
      and substring(c.session from '([0-9]{4})') is not null
    order by s.created_at, s.id
  loop
    roll_prefix := 'UCDIT-' ||
      right(substring(st.session from '([0-9]{4})'), 2) ||
      case when lower(st.class_name) like '%digital leaders%' then 'A' else 'B' end;
    insert into dit_roll_sequences(prefix, next_value) values (roll_prefix, 1)
      on conflict do nothing;
    select next_value into n from dit_roll_sequences
      where dit_roll_sequences.prefix = roll_prefix for update;
    update students set roll_no = roll_prefix || '-' || lpad(n::text, 4, '0')
      where id = st.id and (roll_no is null or btrim(roll_no) = '');
    update dit_roll_sequences set next_value = n + 1 where dit_roll_sequences.prefix = roll_prefix;
  end loop;
end $$;