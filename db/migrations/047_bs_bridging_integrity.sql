-- Keep Bridging classification and semester numbering correct for every write path.
create or replace function normalize_bs_bridging_class()
returns trigger
language plpgsql
as $$
begin
  if new.class_name ilike '%Bridging%' then
    new.type := 'BS-Bridging';
  end if;

  if new.type = 'BS-Bridging' then
    new.total_semesters := 4;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_normalize_bs_bridging_class on classes;
create trigger trg_normalize_bs_bridging_class
before insert or update of class_name, type, total_semesters on classes
for each row execute function normalize_bs_bridging_class();

create or replace function remap_new_bs_bridging_semesters()
returns trigger
language plpgsql
as $$
begin
  if new.type = 'BS-Bridging' and old.type is distinct from new.type then
    update semesters
    set semester_number = semester_number + 4,
        updated_at = now()
    where class_id = new.id
      and semester_number between 1 and 4;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_remap_new_bs_bridging_semesters on classes;
create trigger trg_remap_new_bs_bridging_semesters
after update of class_name, type on classes
for each row execute function remap_new_bs_bridging_semesters();

create or replace function validate_program_semester_number()
returns trigger
language plpgsql
as $$
declare
  program_type class_type;
  program_total integer;
begin
  select type, total_semesters
  into program_type, program_total
  from classes
  where id = new.class_id;

  if program_type = 'BS-Bridging' and new.semester_number not between 5 and 8 then
    raise exception 'BS-Bridging classes use Semesters 5 through 8 only'
      using errcode = '23514';
  elsif program_type <> 'BS-Bridging'
        and (new.semester_number < 1 or new.semester_number > program_total) then
    raise exception 'Semester number is outside the class program range'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_program_semester_number on semesters;
create trigger trg_validate_program_semester_number
before insert or update of class_id, semester_number on semesters
for each row execute function validate_program_semester_number();