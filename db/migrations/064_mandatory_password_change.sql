-- New accounts and default-password resets must choose a personal password.
-- password_version revokes already-issued cookies when an administrator resets.
alter table users
  add column if not exists must_change_password boolean not null default true,
  add column if not exists password_version integer not null default 0;
alter table teachers
  add column if not exists must_change_password boolean not null default true,
  add column if not exists password_version integer not null default 0;
alter table students
  add column if not exists must_change_password boolean not null default true,
  add column if not exists password_version integer not null default 0;
